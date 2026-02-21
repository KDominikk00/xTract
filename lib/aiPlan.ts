import type { User } from "@supabase/supabase-js";

export type AITier = "free" | "plus" | "pro";
export type AIUsageKind = "chat" | "suggestion";
export type AIQuotaSnapshot = {
  tier: AITier;
  remainingChat: number | null;
  remainingSuggestions: number | null;
  resetWindow: "daily" | "monthly" | "unlimited";
  chatLimit: number | null;
  suggestionLimit: number | null;
};

type TierPolicy = {
  chatLimit: number;
  suggestionLimit: number;
  window: "daily" | "monthly" | "unlimited";
};

// Plus limits are intentionally conservative vs model cost so $5 stays viable
// even when prompts are larger than average.
export const AI_TIER_POLICIES: Record<AITier, TierPolicy> = {
  free: { chatLimit: 3, suggestionLimit: 3, window: "daily" },
  plus: { chatLimit: 1000, suggestionLimit: 300, window: "monthly" },
  pro: { chatLimit: Number.POSITIVE_INFINITY, suggestionLimit: Number.POSITIVE_INFINITY, window: "unlimited" },
};

function normalizeTier(value: unknown): AITier {
  if (typeof value !== "string") return "free";
  const normalized = value.trim().toLowerCase();
  if (normalized === "plus") return "plus";
  if (normalized === "pro") return "pro";
  return "free";
}

export function getUserTier(user: User | null | undefined): AITier {
  if (!user) return "free";

  const metadata = user.user_metadata as Record<string, unknown> | undefined;
  const appMetadata = user.app_metadata as Record<string, unknown> | undefined;

  const candidates = [
    metadata?.tier,
    metadata?.plan,
    appMetadata?.tier,
    appMetadata?.plan,
  ];

  for (const candidate of candidates) {
    if (typeof candidate !== "string") continue;
    const parsed = normalizeTier(candidate);
    if (parsed !== "free") return parsed;
  }

  return "free";
}

export function getQuotaWindowKey(tier: AITier, now = new Date()): string {
  const policy = AI_TIER_POLICIES[tier];
  if (policy.window === "daily") {
    const year = now.getUTCFullYear();
    const month = String(now.getUTCMonth() + 1).padStart(2, "0");
    const day = String(now.getUTCDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  if (policy.window === "monthly") {
    const year = now.getUTCFullYear();
    const month = String(now.getUTCMonth() + 1).padStart(2, "0");
    return `${year}-${month}`;
  }
  return "unlimited";
}

export function isUnlimitedTier(tier: AITier): boolean {
  return AI_TIER_POLICIES[tier].window === "unlimited";
}

export function createInitialQuotaSnapshot(tier: AITier): AIQuotaSnapshot {
  const policy = AI_TIER_POLICIES[tier];

  if (policy.window === "unlimited") {
    return {
      tier,
      remainingChat: null,
      remainingSuggestions: null,
      resetWindow: policy.window,
      chatLimit: null,
      suggestionLimit: null,
    };
  }

  return {
    tier,
    remainingChat: policy.chatLimit,
    remainingSuggestions: policy.suggestionLimit,
    resetWindow: policy.window,
    chatLimit: policy.chatLimit,
    suggestionLimit: policy.suggestionLimit,
  };
}
