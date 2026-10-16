import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/server/rateLimit";
import { fetchStockApi } from "@/lib/server/stockApi";

export async function GET(req: NextRequest) {
  const limited = rateLimit(req, { name: "stocks-list", limit: 120, windowMs: 60_000 });
  if (limited) return limited;

  try {
    const n = req.nextUrl.searchParams.get("n");
    const params = new URLSearchParams();

    if (n) {
      params.set("n", n);
    }

    const res = await fetchStockApi("/stocks/gainers", params);

    const payload: unknown = await res.json();

    if (!res.ok) {
      return NextResponse.json(
        { error: "Failed to load gainers.", detail: payload },
        { status: res.status }
      );
    }

    return NextResponse.json(payload);
  } catch (err) {
    console.error("Gainers proxy error:", err);
    return NextResponse.json({ error: "Failed to load gainers." }, { status: 500 });
  }
}
