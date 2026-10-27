import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/server/rateLimit";
import { getUserFromRequest } from "@/lib/server/auth";
import { getOrCreateStripeCustomer } from "@/lib/server/billing";
import { createStripeCheckoutSession, isMissingCustomerError, type BillingPlan } from "@/lib/server/stripe";

type CheckoutBody = {
  plan?: unknown;
};

function isBillingPlan(value: unknown): value is BillingPlan {
  return value === "plus" || value === "pro";
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Per-user burst limit on top of the plan quota, so one account cannot hammer the paid upstream.
    const limited = rateLimit(req, { name: "billing-checkout", key: user.id, limit: 5, windowMs: 60_000 });
    if (limited) return limited;

    const body = (await req.json()) as CheckoutBody;
    if (!isBillingPlan(body.plan)) {
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
    }

    const origin = process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin;
    const createSession = (customerId: string) =>
      createStripeCheckoutSession({
        customerId,
        plan: body.plan as BillingPlan,
        userId: user.id,
        successUrl: `${origin}/?billing=success`,
        cancelUrl: `${origin}/?billing=cancel`,
      });

    let session;
    try {
      session = await createSession(await getOrCreateStripeCustomer(user));
    } catch (error) {
      if (!isMissingCustomerError(error)) throw error;
      // The stored customer id is unknown to the current Stripe key; create a fresh one and retry once.
      console.warn("Stored Stripe customer not found; creating a new one for user", user.id);
      session = await createSession(await getOrCreateStripeCustomer(user, { forceNew: true }));
    }

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("Checkout error:", err);
    return NextResponse.json({ error: "Unable to create checkout session." }, { status: 500 });
  }
}
