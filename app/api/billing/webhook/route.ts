import { NextRequest, NextResponse } from "next/server";
import { logBillingError, markSubscriptionAsCanceled, upsertSubscriptionFromStripe } from "@/lib/server/billing";
import {
  normalizeStripeId,
  retrieveStripeInvoice,
  retrieveStripeSubscription,
  type StripeInvoiceLike,
  verifyStripeWebhookSignature,
  type StripeCheckoutSession,
  type StripeSubscription,
  type StripeWebhookEvent,
} from "@/lib/server/stripe";

export const runtime = "nodejs";

async function handleCheckoutCompleted(session: StripeCheckoutSession) {
  const subscriptionId = normalizeStripeId(session.subscription);
  if (!subscriptionId) return;
  const subscription = await retrieveStripeSubscription(subscriptionId);
  await upsertSubscriptionFromStripe(subscription);
}

async function handleInvoicePaymentEvent(invoicePayment: { invoice?: string | { id?: string } | null }) {
  // invoice_payment.* events carry an invoice id rather than the invoice itself.
  const invoiceId = normalizeStripeId(invoicePayment.invoice);
  if (!invoiceId) return;
  await handleInvoiceEvent(await retrieveStripeInvoice(invoiceId));
}

async function handleSubscriptionEvent(subscription: StripeSubscription) {
  // Webhooks can arrive out of order or be retried late, so sync from Stripe's current state, not the payload.
  const current = await retrieveStripeSubscription(subscription.id);
  await upsertSubscriptionFromStripe(current);
}

async function handleSubscriptionDeleted(subscription: StripeSubscription) {
  const customerId = normalizeStripeId(subscription.customer);
  if (!customerId) return;
  await markSubscriptionAsCanceled(customerId, subscription.id);
}

function getInvoiceSubscriptionId(invoice: StripeInvoiceLike): string | null {
  // Older API versions expose invoice.subscription; newer ones moved it under parent.subscription_details.
  return (
    normalizeStripeId(invoice.subscription) ??
    normalizeStripeId(invoice.parent?.subscription_details?.subscription)
  );
}

async function handleInvoiceEvent(invoice: StripeInvoiceLike) {
  const subscriptionId = getInvoiceSubscriptionId(invoice);
  if (!subscriptionId) return;
  const subscription = await retrieveStripeSubscription(subscriptionId);
  await upsertSubscriptionFromStripe(subscription);
}

export async function POST(req: NextRequest) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json({ error: "Missing STRIPE_WEBHOOK_SECRET" }, { status: 500 });
  }

  try {
    const signature = req.headers.get("stripe-signature");
    if (!signature) {
      return NextResponse.json({ error: "Missing Stripe signature" }, { status: 400 });
    }

    const payload = await req.text();
    const valid = verifyStripeWebhookSignature(payload, signature, webhookSecret);
    if (!valid) {
      return NextResponse.json({ error: "Invalid Stripe signature" }, { status: 400 });
    }

    const event = JSON.parse(payload) as StripeWebhookEvent;

    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object as StripeCheckoutSession);
        break;
      case "customer.subscription.created":
      case "customer.subscription.updated":
        await handleSubscriptionEvent(event.data.object as StripeSubscription);
        break;
      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object as StripeSubscription);
        break;
      case "invoice.paid":
      case "invoice.payment_succeeded":
        await handleInvoiceEvent(event.data.object as StripeInvoiceLike);
        break;
      // Stripe can emit either invoice.* or invoice_payment.* depending on API version/event settings.
      case "invoice_payment.paid":
        await handleInvoicePaymentEvent(event.data.object as { invoice?: string | { id?: string } | null });
        break;
      default:
        break;
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    await logBillingError("Webhook handling failed", err);
    return NextResponse.json({ error: "Webhook error" }, { status: 400 });
  }
}
