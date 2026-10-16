import "server-only";

import { NextResponse, type NextRequest } from "next/server";

type Bucket = { count: number; resetAt: number };

// In-memory fixed windows: fine for the single Render instance; use a shared store if the web service scales out.
const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 10_000;

function sweepExpired(now: number) {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export function getClientIp(req: NextRequest): string {
  return (
    req.headers.get("cf-connecting-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

type RateLimitOptions = {
  /** Namespace so routes have separate budgets. */
  name: string;
  /** Per-IP key by default; pass a user id for authenticated routes. */
  key?: string;
  limit: number;
  windowMs: number;
};

// Returns a 429 response when the caller is over budget, otherwise null.
export function rateLimit(req: NextRequest, { name, key, limit, windowMs }: RateLimitOptions): NextResponse | null {
  const now = Date.now();
  if (buckets.size >= MAX_BUCKETS) sweepExpired(now);

  const bucketKey = `${name}:${key ?? getClientIp(req)}`;
  let bucket = buckets.get(bucketKey);
  if (!bucket || bucket.resetAt <= now) {
    // Still full after sweeping: evict the oldest entry so memory stays bounded.
    if (!bucket && buckets.size >= MAX_BUCKETS) {
      const oldest = buckets.keys().next().value;
      if (oldest !== undefined) buckets.delete(oldest);
    }
    bucket = { count: 0, resetAt: now + windowMs };
    buckets.set(bucketKey, bucket);
  }

  bucket.count += 1;
  if (bucket.count <= limit) return null;

  return NextResponse.json(
    { error: "Too many requests. Please slow down." },
    { status: 429, headers: { "Retry-After": String(Math.ceil((bucket.resetAt - now) / 1000)) } }
  );
}
