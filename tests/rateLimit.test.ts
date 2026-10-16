import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { rateLimit } from "@/lib/server/rateLimit";

const req = (ip: string) => new NextRequest("http://localhost/api/x", { headers: { "x-forwarded-for": ip } });

describe("rateLimit", () => {
  it("allows up to the limit then returns 429 with Retry-After", async () => {
    const opts = { name: "t-limit", limit: 2, windowMs: 60_000 };
    expect(rateLimit(req("1.1.1.1"), opts)).toBeNull();
    expect(rateLimit(req("1.1.1.1"), opts)).toBeNull();
    const blocked = rateLimit(req("1.1.1.1"), opts);
    expect(blocked?.status).toBe(429);
    expect(Number(blocked?.headers.get("Retry-After"))).toBeGreaterThan(0);
  });

  it("tracks callers and route names separately", () => {
    const opts = { name: "t-sep", limit: 1, windowMs: 60_000 };
    expect(rateLimit(req("2.2.2.2"), opts)).toBeNull();
    expect(rateLimit(req("3.3.3.3"), opts)).toBeNull();
    expect(rateLimit(req("2.2.2.2"), { ...opts, name: "t-sep-other" })).toBeNull();
    expect(rateLimit(req("2.2.2.2"), opts)?.status).toBe(429);
  });

  it("uses an explicit key (user id) instead of the IP", () => {
    const opts = { name: "t-key", key: "user-1", limit: 1, windowMs: 60_000 };
    expect(rateLimit(req("4.4.4.4"), opts)).toBeNull();
    expect(rateLimit(req("5.5.5.5"), opts)?.status).toBe(429);
  });
});
