import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/server/rateLimit";
import { getUserFromRequest } from "@/lib/server/auth";
import { getOrCreateStripeCustomer } from "@/lib/server/billing";
import { createStripeCheckoutSession, type BillingPlan } from "@/lib/server/stripe";

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

    const customerId = await getOrCreateStripeCustomer(user);
    const origin = process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin;

    const session = await createStripeCheckoutSession({
      customerId,
      plan: body.plan,
      userId: user.id,
      successUrl: `${origin}/?billing=success`,
      cancelUrl: `${origin}/?billing=cancel`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("Checkout error:", err);
    return NextResponse.json({ error: "Unable to create checkout session." }, { status: 500 });
  }
}
