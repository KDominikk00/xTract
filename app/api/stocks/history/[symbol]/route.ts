import { NextRequest, NextResponse } from "next/server";
import { buildStockApiUrl } from "@/lib/server/stockApi";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ symbol: string }> }
) {
  // In App Router route handlers, dynamic params can arrive as a promise.
  const { symbol } = await params;

  try {
    const period = req.nextUrl.searchParams.get("period") ?? "1mo";
    const interval = req.nextUrl.searchParams.get("interval") ?? "1d";

    const query = new URLSearchParams({ period, interval });

    const res = await fetch(
      buildStockApiUrl(`/stocks/history/${encodeURIComponent(symbol)}`, query),
      { cache: "no-store" }
    );

    const payload: unknown = await res.json();

    if (!res.ok) {
      return NextResponse.json(
        { error: `Failed to load history for ${symbol}.`, detail: payload },
        { status: res.status }
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
