import { NextResponse } from "next/server";
import { buildStockApiUrl } from "@/lib/server/stockApi";

export async function GET() {
  try {
    const res = await fetch(buildStockApiUrl("/stocks/summary-data"), {
      cache: "no-store",
    });

    const payload: unknown = await res.json();

    if (!res.ok) {
      return NextResponse.json(
        { error: "Failed to load market summary.", detail: payload },
        { status: res.status }
      );
    }

    return NextResponse.json(payload);
  } catch (err) {
    console.error("Summary proxy error:", err);
    return NextResponse.json({ error: "Failed to load market summary." }, { status: 500 });
  }
}
