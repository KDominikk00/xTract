import "server-only";

import {
  AI_TIER_POLICIES,
  createInitialQuotaSnapshot,
  getQuotaWindowKey,
  isUnlimitedTier,
  type AITier,
  type AIUsageKind,
  type AIQuotaSnapshot,
} from "@/lib/aiPlan";
import { supabaseAdmin } from "@/lib/server/supabaseAdmin";

type ConsumeQuotaRpcRow = {
  allowed: boolean;
  chat_remaining: number;
  suggestion_remaining: number;
};

export async function getServerQuotaSnapshot(userId: string, tier: AITier): Promise<AIQuotaSnapshot> {
  const policy = AI_TIER_POLICIES[tier];
  if (isUnlimitedTier(tier)) {
    return createInitialQuotaSnapshot(tier);
  }

  const windowKey = getQuotaWindowKey(tier);
  const { data, error } = await supabaseAdmin
    .from("ai_usage")
    .select("chat_used,suggestion_used")
    .eq("user_id", userId)
    .eq("window_key", windowKey)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load AI quota: ${error.message}`);
  }

  const chatUsed = data?.chat_used ?? 0;
  const suggestionUsed = data?.suggestion_used ?? 0;

  return {
    tier,
    remainingChat: Math.max(0, policy.chatLimit - chatUsed),
    remainingSuggestions: Math.max(0, policy.suggestionLimit - suggestionUsed),
    resetWindow: policy.window,
    chatLimit: policy.chatLimit,
    suggestionLimit: policy.suggestionLimit,
  };
}

export async function consumeServerQuota(
  userId: string,
  tier: AITier,
  kind: AIUsageKind
): Promise<{ allowed: boolean; snapshot: AIQuotaSnapshot }> {
  if (isUnlimitedTier(tier)) {
    return {
      allowed: true,
      snapshot: createInitialQuotaSnapshot(tier),
    };
  }

  const policy = AI_TIER_POLICIES[tier];
  const windowKey = getQuotaWindowKey(tier);

  const { data, error } = await supabaseAdmin.rpc("consume_ai_quota", {
    p_user_id: userId,
    p_window_key: windowKey,
    p_usage_kind: kind,
    p_chat_limit: policy.chatLimit,
    p_suggestion_limit: policy.suggestionLimit,
  });

  if (error) {
    throw new Error(`Failed to consume AI quota: ${error.message}`);
  }

  const row = (Array.isArray(data) ? data[0] : null) as ConsumeQuotaRpcRow | null;
  if (!row) {
    throw new Error("Failed to consume AI quota: empty RPC response");
  }

  return {
    allowed: row.allowed,
    snapshot: {
      tier,
      remainingChat: row.chat_remaining,
      remainingSuggestions: row.suggestion_remaining,
      resetWindow: policy.window,
      chatLimit: policy.chatLimit,
      suggestionLimit: policy.suggestionLimit,
    },
  };
}
