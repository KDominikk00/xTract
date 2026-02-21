import { NextRequest, NextResponse } from "next/server";
import { getUserTier, type AITier } from "@/lib/aiPlan";
import { getUserFromRequest } from "@/lib/server/auth";
import { generateGeminiText } from "@/lib/server/gemini";

type SummaryInput = {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
};

type MarketSummaryRequestBody = {
  summary?: unknown;
};

type MarketSummaryResponse = {
  middayReport: string;
  closingReport: string;
};

function isPaidTier(tier: AITier): boolean {
  return tier === "plus" || tier === "pro";
}

function parseSummary(input: unknown): SummaryInput[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((row) => {
      if (typeof row !== "object" || row === null) return null;
      const record = row as Record<string, unknown>;
      if (
        typeof record.symbol !== "string" ||
        typeof record.name !== "string" ||
        typeof record.price !== "number" ||
        typeof record.change !== "number" ||
        typeof record.changePercent !== "number"
      ) {
        return null;
      }
      return {
        symbol: record.symbol,
        name: record.name,
        price: record.price,
        change: record.change,
        changePercent: record.changePercent,
      };
    })
    .filter((row): row is SummaryInput => row !== null)
    .slice(0, 10);
}

function parseReports(text: string): MarketSummaryResponse | null {
  try {
    const parsed = JSON.parse(text) as Record<string, unknown>;
    const midday = typeof parsed.middayReport === "string" ? parsed.middayReport.trim() : "";
    const closing = typeof parsed.closingReport === "string" ? parsed.closingReport.trim() : "";
    if (!midday || !closing) return null;
    return {
      middayReport: midday.slice(0, 900),
      closingReport: closing.slice(0, 900),
    };
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tier = getUserTier(user);
    if (!isPaidTier(tier)) {
      return NextResponse.json(
        { error: "Paid plan required for AI market reports." },
        { status: 403 }
      );
    }

    const body = (await req.json()) as MarketSummaryRequestBody;
    const summary = parseSummary(body.summary);
    if (summary.length === 0) {
      return NextResponse.json({ error: "Summary data is required." }, { status: 400 });
    }

    const reply = await generateGeminiText({
      systemPrompt:
        "You are a senior market strategist. Generate two concise reports for a stock app. " +
        "Use only provided index data. No markdown. Avoid certainty claims and include risk context.",
      userPrompt:
        `Current index snapshot JSON:\n${JSON.stringify(summary, null, 2)}\n\n` +
        "Return strict JSON with keys middayReport and closingReport. " +
        "Each report should be 2-4 sentences in plain English for retail investors.",
      temperature: 0.25,
      maxOutputTokens: 520,
      responseMimeType: "application/json",
    });

    const parsed = parseReports(reply);
    if (!parsed) {
      throw new Error("Invalid market summary response format");
    }

    return NextResponse.json({
      ...parsed,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("AI market summary error:", err);
    return NextResponse.json({ error: "Unable to generate AI market summary." }, { status: 500 });
  }
}
