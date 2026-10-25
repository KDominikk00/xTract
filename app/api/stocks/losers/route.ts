import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/server/rateLimit";
import { fetchStockApi, readJson } from "@/lib/server/stockApi";

export async function GET(req: NextRequest) {
  const limited = rateLimit(req, { name: "stocks-list", limit: 120, windowMs: 60_000 });
  if (limited) return limited;

  try {
    const n = req.nextUrl.searchParams.get("n");
    const params = new URLSearchParams();

    if (n) {
      params.set("n", n);
    }

    const res = await fetchStockApi("/stocks/losers", params);

    const payload: unknown = await readJson(res);

    if (!res.ok || payload === null) {
      return NextResponse.json(
        { error: "Failed to load losers.", detail: payload },
        { status: res.ok ? 502 : res.status }
      );
    }

    return NextResponse.json(payload);
  } catch (err) {
    console.error("Losers proxy error:", err);
    return NextResponse.json({ error: "Failed to load losers." }, { status: 500 });
  }
}
