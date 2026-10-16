import { NextRequest, NextResponse } from "next/server";
import { getUserTier } from "@/lib/aiPlan";
import { generateGeminiText } from "@/lib/server/gemini";
import { rateLimit } from "@/lib/server/rateLimit";
import { getUserFromRequest } from "@/lib/server/auth";
import { consumeServerQuota, refundServerQuota } from "@/lib/server/aiQuota";

type SuggestionBody = {
  symbol?: unknown;
  stock?: unknown;
};

type ParsedSuggestion = {
  label: "Strong Buy" | "Buy" | "Hold" | "Sell" | "Strong Sell";
  reason: string;
};

const VALID_LABELS: ParsedSuggestion["label"][] = ["Strong Buy", "Buy", "Hold", "Sell", "Strong Sell"];

const NUMERIC_STOCK_FIELDS = [
  "currentPrice",
  "open",
  "close",
  "high",
  "low",
  "volume",
  "change",
  "changePercent",
  "marketCap",
  "trailingPE",
  "forwardPE",
  "dividendYield",
  "beta",
] as const;
const TEXT_STOCK_FIELDS = ["name", "sector", "industry"] as const;

// Whitelist fields and cap their size: the payload comes from the client and goes straight into the prompt.
function sanitizeStockPayload(input: unknown): Record<string, number | string> {
  if (typeof input !== "object" || input === null) return {};
  const record = input as Record<string, unknown>;
  const result: Record<string, number | string> = {};

  for (const key of NUMERIC_STOCK_FIELDS) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) result[key] = value;
  }
  for (const key of TEXT_STOCK_FIELDS) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) result[key] = value.trim().slice(0, 100);
  }
  return result;
}

function parseSuggestion(text: string): ParsedSuggestion {
  // Deterministic fallback keeps UI behavior stable when model output is malformed.
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

    // Per-user burst limit on top of the plan quota, so one account cannot hammer the paid upstream.
    const limited = rateLimit(req, { name: "ai-suggestion", key: user.id, limit: 10, windowMs: 60_000 });
    if (limited) return limited;

    const body = (await req.json()) as SuggestionBody;
    if (typeof body.symbol !== "string" || !body.symbol.trim()) {
      return NextResponse.json({ error: "symbol is required" }, { status: 400 });
    }

    const tier = getUserTier(user);

    const symbol = body.symbol.trim().toUpperCase();
    if (!/^[A-Z.\-]{1,12}$/.test(symbol)) {
      return NextResponse.json({ error: "Invalid symbol" }, { status: 400 });
    }
    const stockPayload = sanitizeStockPayload(body.stock);

    // Reserve quota before the paid model call so over-quota or parallel requests never reach Gemini.
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

    let response: string;
    try {
      response = await generateGeminiText({
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
    } catch (modelError) {
      // Transient model errors are not charged to the user.
      await refundServerQuota(user.id, tier, "suggestion");
      throw modelError;
    }

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
