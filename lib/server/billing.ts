import "server-only";

import type { User } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/server/supabaseAdmin";
import {
  createStripeCustomer,
  mapPriceToTier,
  normalizeStripeId,
  type StripeSubscription,
} from "@/lib/server/stripe";

type BillingCustomerRow = {
  user_id: string;
  stripe_customer_id: string;
};

type SubscriptionRow = {
  tier: "free" | "plus" | "pro";
  status: string;
};

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function getOrCreateStripeCustomer(user: User): Promise<string> {
  const { data: existing, error: existingError } = await supabaseAdmin
    .from("billing_customers")
    .select("stripe_customer_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (existingError) {
    throw new Error(`Failed to load billing customer: ${existingError.message}`);
  }
  if (existing?.stripe_customer_id) {
    return existing.stripe_customer_id;
  }

  const customer = await createStripeCustomer({
    email: user.email ?? undefined,
    supabaseUserId: user.id,
  });

  const { error: insertError } = await supabaseAdmin.from("billing_customers").upsert(
    {
      user_id: user.id,
      stripe_customer_id: customer.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );

  if (insertError) {
    throw new Error(`Failed to save billing customer: ${insertError.message}`);
  }

  return customer.id;
}

async function findUserIdByCustomerId(customerId: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from("billing_customers")
    .select("user_id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to find user by customer: ${error.message}`);
  }
  return data?.user_id ?? null;
}

async function updateUserTierMetadata(userId: string, tier: "free" | "plus" | "pro", customerId: string) {
  const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(userId);
  if (userError) {
    throw new Error(`Failed to load user app metadata: ${userError.message}`);
  }

  // Stored in app_metadata (service-role only); user_metadata is user-editable and must not carry the plan.
  const current = (userData.user?.app_metadata ?? {}) as Record<string, unknown>;
  const merged = {
    ...current,
    tier,
    plan: tier,
    stripe_customer_id: customerId,
  };

  const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
    app_metadata: merged,
  });
  if (updateError) {
    throw new Error(`Failed to update user tier: ${updateError.message}`);
  }
}

function resolveTierFromSubscription(subscription: StripeSubscription): "free" | "plus" | "pro" {
  if (!(subscription.status === "active" || subscription.status === "trialing")) {
    return "free";
  }

  const primaryPriceId = subscription.items.data[0]?.price?.id ?? null;
  // Price ID is the primary source of truth; metadata fallback handles legacy/test sessions.
  const mapped = mapPriceToTier(primaryPriceId);
  if (mapped !== "free") return mapped;

  const metadataPlan = subscription.metadata?.plan?.trim().toLowerCase();
  if (metadataPlan === "pro") return "pro";
  if (metadataPlan === "plus") return "plus";
  return "free";
}

function maxTier(a: "free" | "plus" | "pro", b: "free" | "plus" | "pro"): "free" | "plus" | "pro" {
  const rank = { free: 0, plus: 1, pro: 2 } as const;
  return rank[a] >= rank[b] ? a : b;
}

async function recalculateAndSyncUserTier(userId: string, customerId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_subscriptions")
    .select("tier,status")
    .eq("user_id", userId);

  if (error) {
    throw new Error(`Failed to load user subscriptions: ${error.message}`);
  }

  const rows = (data ?? []) as SubscriptionRow[];
  let effectiveTier: "free" | "plus" | "pro" = "free";

  // Keep the highest active tier in case overlapping subscriptions exist during plan changes.
  for (const row of rows) {
    if (row.status !== "active" && row.status !== "trialing") continue;
    effectiveTier = maxTier(effectiveTier, row.tier);
  }

  await updateUserTierMetadata(userId, effectiveTier, customerId);
}

export async function upsertSubscriptionFromStripe(subscription: StripeSubscription) {
  const customerId = normalizeStripeId(subscription.customer);
  if (!customerId) {
    throw new Error(`Invalid Stripe customer on subscription ${subscription.id}`);
  }

  let userId = subscription.metadata?.user_id ?? null;
  if (!userId) {
    userId = await findUserIdByCustomerId(customerId);
  }
  if (!userId) {
    throw new Error(`No user mapping found for Stripe customer ${customerId}`);
  }

  const primaryPriceId = subscription.items.data[0]?.price?.id ?? null;
  const tier = resolveTierFromSubscription(subscription);

  const { error: customerUpsertError } = await supabaseAdmin.from("billing_customers").upsert(
    {
      user_id: userId,
      stripe_customer_id: customerId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );
  if (customerUpsertError) {
    throw new Error(`Failed to sync billing customer: ${customerUpsertError.message}`);
  }

  const currentPeriodEndIso =
    typeof subscription.current_period_end === "number"
      ? new Date(subscription.current_period_end * 1000).toISOString()
      : null;

  const { error: subscriptionError } = await supabaseAdmin.from("user_subscriptions").upsert(
    {
      id: subscription.id,
      user_id: userId,
      stripe_customer_id: customerId,
      status: subscription.status,
      price_id: primaryPriceId,
      tier,
      cancel_at_period_end: subscription.cancel_at_period_end,
      current_period_end: currentPeriodEndIso,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  );

  if (subscriptionError) {
    throw new Error(`Failed to sync subscription: ${subscriptionError.message}`);
  }

  await recalculateAndSyncUserTier(userId, customerId);
}

export async function markSubscriptionAsCanceled(customerId: string, subscriptionId: string) {
  const userId = await findUserIdByCustomerId(customerId);
  if (!userId) return;

  const { error } = await supabaseAdmin
    .from("user_subscriptions")
    .update({ tier: "free", status: "canceled", updated_at: new Date().toISOString() })
    // Only the deleted subscription: a replacement subscription may already be active.
    .eq("id", subscriptionId);

  if (error) {
    throw new Error(`Failed to mark subscription as canceled: ${error.message}`);
  }

  await recalculateAndSyncUserTier(userId, customerId);
}

export async function logBillingError(context: string, err: unknown) {
  console.error(`[billing] ${context}: ${toErrorMessage(err)}`);
}

export async function getCustomerIdForUser(userId: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from("billing_customers")
    .select("stripe_customer_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load customer id: ${error.message}`);
  }

  return (data as BillingCustomerRow | null)?.stripe_customer_id ?? null;
}
