import { NextRequest, NextResponse } from "next/server";
import { getUserTier } from "@/lib/aiPlan";
import { generateGeminiText, type AIChatTurn } from "@/lib/server/gemini";
import { rateLimit } from "@/lib/server/rateLimit";
import { getUserFromRequest } from "@/lib/server/auth";
import { consumeServerQuota, refundServerQuota } from "@/lib/server/aiQuota";

type ChatRequestBody = {
  message?: unknown;
  history?: unknown;
  context?: unknown;
};

type ScreenContext = {
  pathname?: string;
  title?: string;
  screenText?: string;
};

function parseHistory(input: unknown): AIChatTurn[] {
  if (!Array.isArray(input)) return [];

  return input
    // Keep only the most recent turns to control token usage and request latency.
    .slice(-8)
    .map((item) => {
      if (typeof item !== "object" || item === null) return null;
      const role = (item as Record<string, unknown>).role;
      const content = (item as Record<string, unknown>).content;
      if (role !== "user" && role !== "assistant") return null;
      if (typeof content !== "string") return null;
      return {
        role,
        content: content.slice(0, 1000),
      } as AIChatTurn;
    })
    .filter((item): item is AIChatTurn => item !== null);
}

function parseContext(input: unknown): ScreenContext {
  if (typeof input !== "object" || input === null) return {};
  const record = input as Record<string, unknown>;
  return {
    pathname: typeof record.pathname === "string" ? record.pathname : undefined,
    title: typeof record.title === "string" ? record.title : undefined,
    screenText: typeof record.screenText === "string" ? record.screenText : undefined,
  };
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Per-user burst limit on top of the plan quota, so one account cannot hammer the paid upstream.
    const limited = rateLimit(req, { name: "ai-chat", key: user.id, limit: 10, windowMs: 60_000 });
    if (limited) return limited;

    const body = (await req.json()) as ChatRequestBody;
    if (typeof body.message !== "string" || !body.message.trim()) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    const message = body.message.trim().slice(0, 2500);
    const history = parseHistory(body.history);
    const context = parseContext(body.context);
    const tier = getUserTier(user);

    const contextBlock = [
      `Path: ${context.pathname ?? "unknown"}`,
      `Title: ${context.title ?? "unknown"}`,
      "",
      "Visible content snapshot:",
      // Hard cap avoids very large DOM snapshots blowing up the model prompt.
      (context.screenText ?? "No context provided.").slice(0, 7000),
    ].join("\n");

    // Reserve quota before the paid model call so over-quota or parallel requests never reach Gemini.
    const quotaCheck = await consumeServerQuota(user.id, tier, "chat");
    if (!quotaCheck.allowed) {
      return NextResponse.json(
        {
          error: "AI chat quota reached for your current plan.",
          quota: quotaCheck.snapshot,
          tier,
        },
        { status: 429 }
      );
    }

    let reply: string;
    try {
      reply = await generateGeminiText({
        systemPrompt:
          "You are xTract AI, a professional stock-market assistant inside a stock analytics app. " +
          "Prioritize on-screen context when relevant, but you can also answer broader stock, investing, " +
          "portfolio, and market-structure questions even when context is limited. " +
          "If real-time data is unavailable or uncertain, clearly say that and provide the best practical guidance. " +
          "Keep answers concise, actionable, and avoid false certainty.",
        history,
        userPrompt: `On-screen context:\n${contextBlock}\n\nUser question:\n${message}`,
        temperature: 0.25,
        maxOutputTokens: 550,
      });
    } catch (modelError) {
      // Transient model errors are not charged to the user.
      await refundServerQuota(user.id, tier, "chat");
      throw modelError;
    }

    return NextResponse.json({ reply, quota: quotaCheck.snapshot, tier });
  } catch (err) {
    console.error("AI chat error:", err);
    return NextResponse.json({ error: "Unable to process AI chat right now." }, { status: 500 });
  }
}
