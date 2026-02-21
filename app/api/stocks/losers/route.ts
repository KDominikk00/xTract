import { NextRequest, NextResponse } from "next/server";
import { buildStockApiUrl } from "@/lib/server/stockApi";

export async function GET(req: NextRequest) {
  try {
    const n = req.nextUrl.searchParams.get("n");
    const params = new URLSearchParams();

    if (n) {
      params.set("n", n);
    }

    const res = await fetch(buildStockApiUrl("/stocks/losers", params), {
      cache: "no-store",
    });

    const payload: unknown = await res.json();

    if (!res.ok) {
      return NextResponse.json(
        { error: "Failed to load losers.", detail: payload },
        { status: res.status }
      );
    }

    return NextResponse.json(payload);
  } catch (err) {
    console.error("Losers proxy error:", err);
    return NextResponse.json({ error: "Failed to load losers." }, { status: 500 });
  }
}
