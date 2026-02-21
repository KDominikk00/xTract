import { NextRequest, NextResponse } from "next/server";
import { getUserTier } from "@/lib/aiPlan";
import { generateGeminiText } from "@/lib/server/gemini";
import { getUserFromRequest } from "@/lib/server/auth";
import { consumeServerQuota } from "@/lib/server/aiQuota";

type SuggestionBody = {
  symbol?: unknown;
  stock?: unknown;
};

type ParsedSuggestion = {
  label: "Strong Buy" | "Buy" | "Hold" | "Sell" | "Strong Sell";
  reason: string;
};

const VALID_LABELS: ParsedSuggestion["label"][] = ["Strong Buy", "Buy", "Hold", "Sell", "Strong Sell"];

function parseSuggestion(text: string): ParsedSuggestion {
  const fallback: ParsedSuggestion = {
    label: "Hold",
    reason: "Not enough confidence from current metrics. This is informational, not financial advice.",
  };

  try {
    const parsed = JSON.parse(text) as Record<string, unknown>;
    const label = typeof parsed.label === "string" ? parsed.label : "";
    const reason = typeof parsed.reason === "string" ? parsed.reason : "";
    if (!VALID_LABELS.includes(label as ParsedSuggestion["label"])) return fallback;
    if (!reason.trim()) return fallback;
    return {
      label: label as ParsedSuggestion["label"],
      reason: reason.trim().slice(0, 220),
    };
  } catch {
    return fallback;
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as SuggestionBody;
    if (typeof body.symbol !== "string" || !body.symbol.trim()) {
      return NextResponse.json({ error: "symbol is required" }, { status: 400 });
    }

    const tier = getUserTier(user);
    const quotaCheck = await consumeServerQuota(user.id, tier, "suggestion");
    if (!quotaCheck.allowed) {
      return NextResponse.json(
        {
          error: "AI suggestion quota reached for your current plan.",
          quota: quotaCheck.snapshot,
          tier,
        },
        { status: 429 }
      );
    }

    const stockPayload = typeof body.stock === "object" && body.stock !== null ? body.stock : {};
    const symbol = body.symbol.toUpperCase().slice(0, 12);

    const response = await generateGeminiText({
      systemPrompt:
        "You are an equity research assistant. Provide one informational suggestion label " +
        "from this exact set: Strong Buy, Buy, Hold, Sell, Strong Sell. " +
        "Use only provided data and avoid certainty language. " +
        "Return strict JSON with keys label and reason. No markdown.",
      userPrompt:
        `Symbol: ${symbol}\n` +
        `Stock data JSON:\n${JSON.stringify(stockPayload, null, 2)}\n\n` +
        "Return JSON like: " +
        '{"label":"Hold","reason":"One short reason under 220 chars. Mention this is informational."}',
      temperature: 0.2,
      maxOutputTokens: 220,
      responseMimeType: "application/json",
    });

    const parsed = parseSuggestion(response);
    return NextResponse.json({
      label: parsed.label,
      reason: parsed.reason,
      generatedAt: new Date().toISOString(),
      quota: quotaCheck.snapshot,
      tier,
    });
  } catch (err) {
    console.error("AI suggestion error:", err);
    return NextResponse.json({ error: "Unable to generate AI suggestion right now." }, { status: 500 });
  }
}
