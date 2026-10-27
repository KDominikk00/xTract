import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  isMissingCustomerError,
  mapPriceToTier,
  normalizeStripeId,
  StripeApiError,
  verifyStripeWebhookSignature,
} from "@/lib/server/stripe";

const secret = "whsec_test";
const payload = JSON.stringify({ id: "evt_1", type: "customer.subscription.updated" });

function sign(timestamp: number, body = payload, key = secret) {
  return createHmac("sha256", key).update(`${timestamp}.${body}`).digest("hex");
}

describe("verifyStripeWebhookSignature", () => {
  const now = Math.floor(Date.now() / 1000);

  it("accepts a valid, fresh signature", () => {
    expect(verifyStripeWebhookSignature(payload, `t=${now},v1=${sign(now)}`, secret)).toBe(true);
  });

  it("accepts when any of several v1 signatures matches", () => {
    expect(verifyStripeWebhookSignature(payload, `t=${now},v1=deadbeef,v1=${sign(now)}`, secret)).toBe(true);
  });

  it("rejects a tampered payload or wrong secret", () => {
    expect(verifyStripeWebhookSignature(payload + " ", `t=${now},v1=${sign(now)}`, secret)).toBe(false);
    expect(verifyStripeWebhookSignature(payload, `t=${now},v1=${sign(now, payload, "other")}`, secret)).toBe(false);
  });

  it("rejects stale timestamps and malformed headers", () => {
    const old = now - 3600;
    expect(verifyStripeWebhookSignature(payload, `t=${old},v1=${sign(old)}`, secret)).toBe(false);
    expect(verifyStripeWebhookSignature(payload, "garbage", secret)).toBe(false);
    expect(verifyStripeWebhookSignature(payload, `t=abc,v1=${sign(now)}`, secret)).toBe(false);
  });
});

describe("helpers", () => {
  it("maps price ids to tiers", () => {
    expect(mapPriceToTier("price_pro")).toBe("pro");
    expect(mapPriceToTier("price_plus")).toBe("plus");
    expect(mapPriceToTier("price_other")).toBe("free");
    expect(mapPriceToTier(null)).toBe("free");
  });

  it("normalizes string and expanded object ids", () => {
    expect(normalizeStripeId("sub_1")).toBe("sub_1");
    expect(normalizeStripeId({ id: "sub_2" })).toBe("sub_2");
    expect(normalizeStripeId({})).toBeNull();
    expect(normalizeStripeId("  ")).toBeNull();
  });
});

describe("isMissingCustomerError", () => {
  it("matches only Stripe's unknown-customer error", () => {
    expect(isMissingCustomerError(new StripeApiError("No such customer", 400, "resource_missing", "customer"))).toBe(true);
    expect(isMissingCustomerError(new StripeApiError("No such price", 400, "resource_missing", "line_items[0][price]"))).toBe(false);
    expect(isMissingCustomerError(new StripeApiError("Rate limited", 429, "rate_limit"))).toBe(false);
    expect(isMissingCustomerError(new Error("No such customer"))).toBe(false);
  });
});
