import { NextRequest, NextResponse } from "next/server";
import { normalizeSymbol } from "@/lib/symbols";
import { rateLimit } from "@/lib/server/rateLimit";
import { fetchStockApi, readJson } from "@/lib/server/stockApi";

// Vercel function limit: stock API retries (cold start) and Gemini calls can take up to a minute.
export const maxDuration = 60;

type QuotesRequestBody = {
  symbols?: unknown;
};

type QuoteResponseRow = {
  symbol: string;
  name: string;
  currentPrice: number;
  changePercent: number;
};

function parseSymbols(input: unknown): string[] {
  if (!Array.isArray(input)) return [];

  const parsed = input
    .map((value) => normalizeSymbol(value))
    .filter((symbol): symbol is string => symbol !== null);

  return Array.from(new Set(parsed)).slice(0, 30);
}

// Quotes come from the stock API, which caches them, instead of hitting Yahoo directly per request.
async function fetchQuoteRow(symbol: string): Promise<QuoteResponseRow | null> {
  try {
    const res = await fetchStockApi(`/stocks/quote/${encodeURIComponent(symbol)}`);
    if (!res.ok) return null;

    const quote = (await readJson(res)) as Record<string, unknown>;
    const price = quote.price;
    const changePercent = quote.changesPercentage;
    if (typeof price !== "number" || typeof changePercent !== "number") return null;

    return {
      symbol,
      name: typeof quote.name === "string" && quote.name.trim() ? quote.name : symbol,
      currentPrice: price,
      changePercent,
    };
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, { name: "stocks-quotes", limit: 60, windowMs: 60_000 });
  if (limited) return limited;

  try {
    const body = (await req.json()) as QuotesRequestBody;
    const symbols = parseSymbols(body.symbols);

    if (symbols.length === 0) {
      return NextResponse.json({ quotes: [] });
    }

    const results = await Promise.all(symbols.map(fetchQuoteRow));

    return NextResponse.json({
      quotes: results.filter((row): row is QuoteResponseRow => row !== null),
    });
  } catch (err) {
    console.error("Quotes route error:", err);
    return NextResponse.json({ error: "Unable to fetch quotes." }, { status: 500 });
  }
}
