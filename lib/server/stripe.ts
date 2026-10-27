import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

if (!stripeSecretKey) {
  throw new Error("Missing STRIPE_SECRET_KEY");
}

export type BillingPlan = "plus" | "pro";

export type StripeSubscription = {
  id: string;
  customer: string | { id?: string };
  status: string;
  cancel_at_period_end: boolean;
  current_period_end?: number | null;
  metadata?: Record<string, string>;
  items: {
    data: Array<{
      price?: {
        id?: string;
      };
    }>;
  };
};

export type StripeCheckoutSession = {
  id: string;
  url?: string;
  subscription?: string | { id: string } | null;
  metadata?: Record<string, string>;
};

export type StripeInvoiceLike = {
  subscription?: string | { id?: string } | null;
  parent?: { subscription_details?: { subscription?: string | { id?: string } | null } | null } | null;
};

export type StripeWebhookEvent = {
  id: string;
  type: string;
  data: {
    object: Record<string, unknown>;
  };
};

type StripeRequestOptions = {
  method?: "GET" | "POST";
  params?: URLSearchParams;
  idempotencyKey?: string;
};

const WEBHOOK_TOLERANCE_SECONDS = 300;
const STRIPE_TIMEOUT_MS = 20_000;

function getPlanPriceId(plan: BillingPlan): string {
  if (plan === "plus") {
    const priceId = process.env.STRIPE_PLUS_PRICE_ID;
    if (!priceId) throw new Error("Missing STRIPE_PLUS_PRICE_ID");
    return priceId;
  }

  const priceId = process.env.STRIPE_PRO_PRICE_ID;
  if (!priceId) throw new Error("Missing STRIPE_PRO_PRICE_ID");
  return priceId;
}

export function mapPriceToTier(priceId: string | null | undefined): "free" | "plus" | "pro" {
  if (!priceId) return "free";
  if (priceId === process.env.STRIPE_PRO_PRICE_ID) return "pro";
  if (priceId === process.env.STRIPE_PLUS_PRICE_ID) return "plus";
  return "free";
}

export class StripeApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
    readonly param?: string
  ) {
    super(message);
    this.name = "StripeApiError";
  }
}

// True when Stripe says the referenced customer does not exist (e.g. data created under a different key/mode).
export function isMissingCustomerError(error: unknown): boolean {
  return error instanceof StripeApiError && error.code === "resource_missing" && error.param === "customer";
}

async function stripeRequest<T>(path: string, options: StripeRequestOptions = {}): Promise<T> {
  const { method = "GET", params, idempotencyKey } = options;
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${stripeSecretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
    },
    body: method === "POST" ? params?.toString() : undefined,
    signal: AbortSignal.timeout(STRIPE_TIMEOUT_MS),
  });

  const json = (await res.json()) as T & { error?: { message?: string; code?: string; param?: string } };
  if (!res.ok) {
    throw new StripeApiError(json.error?.message ?? "Stripe request failed", res.status, json.error?.code, json.error?.param);
  }

  return json;
}

export async function createStripeCustomer(input: {
  email?: string;
  supabaseUserId: string;
}): Promise<{ id: string }> {
  const params = new URLSearchParams();
  if (input.email) params.append("email", input.email);
  params.append("metadata[supabase_user_id]", input.supabaseUserId);
  // Same user + email within Stripe's idempotency window returns the same customer, so a double-click
  // on checkout cannot create duplicate Stripe customers.
  return stripeRequest<{ id: string }>("customers", {
    method: "POST",
    params,
    idempotencyKey: `create-customer:${input.supabaseUserId}:${input.email ?? ""}`,
  });
}

export async function createStripeCheckoutSession(input: {
  customerId: string;
  plan: BillingPlan;
  userId: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<StripeCheckoutSession> {
  const params = new URLSearchParams();
  params.append("mode", "subscription");
  params.append("customer", input.customerId);
  params.append("line_items[0][price]", getPlanPriceId(input.plan));
  params.append("line_items[0][quantity]", "1");
  params.append("success_url", input.successUrl);
  params.append("cancel_url", input.cancelUrl);
  params.append("allow_promotion_codes", "true");
  // Keep metadata on both objects because different webhook events expose different payload shapes.
  params.append("metadata[user_id]", input.userId);
  params.append("metadata[plan]", input.plan);
  params.append("subscription_data[metadata][user_id]", input.userId);
  params.append("subscription_data[metadata][plan]", input.plan);

  return stripeRequest<StripeCheckoutSession>("checkout/sessions", { method: "POST", params });
}

export async function createStripeBillingPortalSession(input: {
  customerId: string;
  returnUrl: string;
}): Promise<{ url: string }> {
  const params = new URLSearchParams();
  params.append("customer", input.customerId);
  params.append("return_url", input.returnUrl);
  return stripeRequest<{ url: string }>("billing_portal/sessions", { method: "POST", params });
}

export async function retrieveStripeSubscription(subscriptionId: string): Promise<StripeSubscription> {
  return stripeRequest<StripeSubscription>(`subscriptions/${subscriptionId}`);
}

export async function retrieveStripeInvoice(invoiceId: string): Promise<StripeInvoiceLike> {
  return stripeRequest<StripeInvoiceLike>(`invoices/${invoiceId}`);
}

export function normalizeStripeId(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value;
  if (typeof value === "object" && value !== null) {
    const id = (value as { id?: unknown }).id;
    if (typeof id === "string" && id.trim()) return id;
  }
  return null;
}

export function verifyStripeWebhookSignature(payload: string, signatureHeader: string, secret: string): boolean {
  const parts = signatureHeader.split(",");
  const timestamp = parts.find((part) => part.startsWith("t="))?.slice(2);
  const signatures = parts
    .filter((part) => part.startsWith("v1="))
    .map((part) => part.slice(3));

  if (!timestamp || signatures.length === 0) return false;
  const parsedTimestamp = Number(timestamp);
  if (!Number.isFinite(parsedTimestamp)) return false;

  const currentTimestamp = Math.floor(Date.now() / 1000);
  // Reject stale signatures to reduce replay risk if a payload is leaked.
  if (Math.abs(currentTimestamp - parsedTimestamp) > WEBHOOK_TOLERANCE_SECONDS) return false;

  const signedPayload = `${timestamp}.${payload}`;
  const digest = createHmac("sha256", secret).update(signedPayload).digest("hex");

  return signatures.some((signature) => {
    try {
      // Constant-time compare avoids timing side channels during signature checks.
      return timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
    } catch {
      return false;
    }
  });
}
