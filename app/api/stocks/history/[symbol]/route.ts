import { NextRequest, NextResponse } from "next/server";
import { normalizeSymbol } from "@/lib/symbols";
import { rateLimit } from "@/lib/server/rateLimit";
import { fetchStockApi, readJson } from "@/lib/server/stockApi";

// Vercel function limit: stock API retries (cold start) and Gemini calls can take up to a minute.
export const maxDuration = 60;

// Only the ranges the charts use; arbitrary values would let callers trigger expensive upstream queries.
const ALLOWED_PERIODS = new Set(["1d", "5d", "1mo", "3mo", "6mo", "ytd", "1y"]);
const ALLOWED_INTERVALS = new Set(["5m", "15m", "30m", "1h", "1d"]);

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ symbol: string }> }
) {
  const limited = rateLimit(req, { name: "stocks-history", limit: 180, windowMs: 60_000 });
  if (limited) return limited;

  // In App Router route handlers, dynamic params can arrive as a promise.
  const { symbol: rawSymbol } = await params;
  const symbol = normalizeSymbol(rawSymbol);
  if (!symbol) {
    return NextResponse.json({ error: "Invalid stock symbol" }, { status: 400 });
  }

  try {
    const period = req.nextUrl.searchParams.get("period") ?? "1mo";
    const interval = req.nextUrl.searchParams.get("interval") ?? "1d";
    if (!ALLOWED_PERIODS.has(period) || !ALLOWED_INTERVALS.has(interval)) {
      return NextResponse.json({ error: "Invalid period or interval" }, { status: 400 });
    }

    const query = new URLSearchParams({ period, interval });

    const res = await fetchStockApi(`/stocks/history/${encodeURIComponent(symbol)}`, query);

    const payload: unknown = await readJson(res);

    if (!res.ok || payload === null) {
      return NextResponse.json(
        { error: `Failed to load history for ${symbol}.`, detail: payload },
        { status: res.ok ? 502 : res.status }
      );
    }

    return NextResponse.json(payload);
  } catch (err) {
    console.error("History proxy error:", err);
    return NextResponse.json(
      { error: `Failed to load history for ${symbol}.` },
      { status: 500 }
    );
  }
}
