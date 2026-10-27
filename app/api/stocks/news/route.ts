import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/server/rateLimit";
import { fetchStockApi, readJson } from "@/lib/server/stockApi";

// Vercel function limit: stock API retries (cold start) and Gemini calls can take up to a minute.
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const limited = rateLimit(req, { name: "stocks-list", limit: 120, windowMs: 60_000 });
  if (limited) return limited;

  try {
    const n = req.nextUrl.searchParams.get("n");
    const params = new URLSearchParams();

    if (n) {
      params.set("n", n);
    }

    const res = await fetchStockApi("/stocks/news", params);

    const payload: unknown = await readJson(res);

    if (!res.ok || payload === null) {
      return NextResponse.json(
        { error: "Failed to load news.", detail: payload },
        { status: res.ok ? 502 : res.status }
      );
    }

    return NextResponse.json(payload);
  } catch (err) {
    console.error("News proxy error:", err);
    return NextResponse.json({ error: "Failed to load news." }, { status: 500 });
  }
}
