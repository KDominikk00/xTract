import type { User } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { getQuotaWindowKey, getUserTier } from "@/lib/aiPlan";

const makeUser = (fields: Partial<User>) => fields as User;

describe("getUserTier", () => {
  it("defaults to free", () => {
    expect(getUserTier(null)).toBe("free");
    expect(getUserTier(makeUser({}))).toBe("free");
  });

  it("reads the tier from app_metadata", () => {
    expect(getUserTier(makeUser({ app_metadata: { tier: "pro" } }))).toBe("pro");
    expect(getUserTier(makeUser({ app_metadata: { plan: " Plus " } }))).toBe("plus");
  });

  it("ignores user-editable user_metadata", () => {
    expect(getUserTier(makeUser({ user_metadata: { tier: "pro", plan: "pro" } }))).toBe("free");
  });

  it("treats unknown values as free", () => {
    expect(getUserTier(makeUser({ app_metadata: { tier: "enterprise" } }))).toBe("free");
  });
});

describe("getQuotaWindowKey", () => {
  const now = new Date("2026-03-09T23:59:59Z");

  it("uses UTC day for free and month for plus", () => {
    expect(getQuotaWindowKey("free", now)).toBe("2026-03-09");
    expect(getQuotaWindowKey("plus", now)).toBe("2026-03");
    expect(getQuotaWindowKey("pro", now)).toBe("unlimited");
  });
});
