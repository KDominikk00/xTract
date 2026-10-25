import { NextRequest, NextResponse } from "next/server";
import { normalizeSymbol } from "@/lib/symbols";
import { rateLimit } from "@/lib/server/rateLimit";
import { fetchStockApi, readJson } from "@/lib/server/stockApi";

type StockApiQuote = Record<string, unknown>;

function toNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function toPrice(value: unknown, fallback = 0): number {
  return Math.round((toNumber(value, fallback) + Number.EPSILON) * 100) / 100;
}

function toOptionalNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function toOptionalPrice(value: unknown): number | null {
  const number = toOptionalNumber(value);
  return number === null ? null : Math.round((number + Number.EPSILON) * 100) / 100;
}

function toString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function mapQuote(quote: StockApiQuote, requestedSymbol: string) {
  return {
    name: toString(quote.name, requestedSymbol),
    symbol: toString(quote.symbol, requestedSymbol),
    currentPrice: toPrice(quote.price),
    open: toPrice(quote.open),
    close: toPrice(quote.previousClose),
    high: toPrice(quote.dayHigh),
    low: toPrice(quote.dayLow),
    volume: toNumber(quote.volume),
    change: toNumber(quote.change),
    changePercent: toNumber(quote.changesPercentage),
    marketCap: toOptionalNumber(quote.marketCap),
    previousClose: toOptionalPrice(quote.previousClose),
    fiftyTwoWeekHigh: toOptionalPrice(quote.yearHigh),
    fiftyTwoWeekLow: toOptionalPrice(quote.yearLow),
    trailingPE: toOptionalPrice(quote.pe),
    forwardPE: null,
    dividendYield: null,
    beta: null,
    earningsTimestamp: null,
    earningsDate: null,
    sector: null,
    industry: null,
    description: null,
  };
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ symbol: string }> }
) {
  const limited = rateLimit(req, { name: "stocks-quote", limit: 120, windowMs: 60_000 });
  if (limited) return limited;

  const { symbol } = await params;
  const normalizedSymbol = normalizeSymbol(symbol);

  if (!normalizedSymbol) {
    return NextResponse.json({ error: "Invalid stock symbol" }, { status: 400 });
  }

  try {
    // Route individual quotes through the FMP-backed API instead of Yahoo's rate-limited endpoint.
    const res = await fetchStockApi(`/stocks/quote/${encodeURIComponent(normalizedSymbol)}`);
    const payload: unknown = await readJson(res);

    if (!res.ok || typeof payload !== "object" || payload === null || Array.isArray(payload)) {
      console.error("Stock quote API error:", res.status, payload);
      return NextResponse.json({ error: "Failed to fetch stock" }, { status: res.ok ? 502 : res.status || 502 });
    }

    return NextResponse.json(mapQuote(payload as StockApiQuote, normalizedSymbol));
  } catch (err) {
    console.error("Stock quote proxy error:", err);
    return NextResponse.json({ error: "Failed to fetch stock" }, { status: 502 });
  }
}
