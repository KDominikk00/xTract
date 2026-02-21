"use client";

import {
  AI_TIER_POLICIES,
  type AITier,
  type AIUsageKind,
  type AIQuotaSnapshot,
  getQuotaWindowKey,
  isUnlimitedTier,
} from "@/lib/aiPlan";

type QuotaStoreRecord = {
  windowKey: string;
  chatUsed: number;
  suggestionUsed: number;
};

type QuotaStore = Partial<Record<AITier, QuotaStoreRecord>>;

type SuggestionRecord = {
  label: string;
  reason: string;
  generatedAt: string;
};

type SuggestionStore = Record<string, SuggestionRecord>;
type MarketSummaryRecord = {
  signature: string;
  middayReport: string;
  closingReport: string;
  generatedAt: string;
  cachedAt: string;
};
type MarketSummaryStore = Partial<Record<AITier, MarketSummaryRecord>>;

const QUOTA_STORAGE_KEY = "xtract-ai-quota-v1";
const SUGGESTION_STORAGE_KEY = "xtract-ai-suggestion-v1";
const MARKET_SUMMARY_STORAGE_KEY = "xtract-ai-market-summary-v1";
const MARKET_SUMMARY_TTL_MS = 2 * 60 * 60 * 1000;

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  const raw = window.localStorage.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

function getTierRecord(tier: AITier, now = new Date()): QuotaStoreRecord {
  const store = readJson<QuotaStore>(QUOTA_STORAGE_KEY, {});
  const windowKey = getQuotaWindowKey(tier, now);
  const existing = store[tier];

  if (!existing || existing.windowKey !== windowKey) {
    const fresh: QuotaStoreRecord = {
      windowKey,
      chatUsed: 0,
      suggestionUsed: 0,
    };
    store[tier] = fresh;
    writeJson(QUOTA_STORAGE_KEY, store);
    return fresh;
  }

  return existing;
}

function setTierRecord(tier: AITier, record: QuotaStoreRecord): void {
  const store = readJson<QuotaStore>(QUOTA_STORAGE_KEY, {});
  store[tier] = record;
  writeJson(QUOTA_STORAGE_KEY, store);
}

export function getQuotaSnapshot(tier: AITier, now = new Date()): AIQuotaSnapshot {
  const policy = AI_TIER_POLICIES[tier];
  if (isUnlimitedTier(tier)) {
    return {
      tier,
      remainingChat: null,
      remainingSuggestions: null,
      resetWindow: policy.window,
      chatLimit: null,
      suggestionLimit: null,
    };
  }

  const record = getTierRecord(tier, now);

  return {
    tier,
    remainingChat: Math.max(0, policy.chatLimit - record.chatUsed),
    remainingSuggestions: Math.max(0, policy.suggestionLimit - record.suggestionUsed),
    resetWindow: policy.window,
    chatLimit: policy.chatLimit,
    suggestionLimit: policy.suggestionLimit,
  };
}

export function tryConsumeQuota(tier: AITier, kind: AIUsageKind): { ok: boolean; snapshot: AIQuotaSnapshot } {
  const policy = AI_TIER_POLICIES[tier];
  if (isUnlimitedTier(tier)) {
    return { ok: true, snapshot: getQuotaSnapshot(tier) };
  }

  const record = getTierRecord(tier);
  const currentValue = kind === "chat" ? record.chatUsed : record.suggestionUsed;
  const limit = kind === "chat" ? policy.chatLimit : policy.suggestionLimit;

  if (currentValue >= limit) {
    return { ok: false, snapshot: getQuotaSnapshot(tier) };
  }

  const nextRecord: QuotaStoreRecord =
    kind === "chat"
      ? { ...record, chatUsed: record.chatUsed + 1 }
      : { ...record, suggestionUsed: record.suggestionUsed + 1 };

  setTierRecord(tier, nextRecord);

  return { ok: true, snapshot: getQuotaSnapshot(tier) };
}

function buildSuggestionKey(tier: AITier, symbol: string, now = new Date()): string {
  return `${tier}:${getQuotaWindowKey(tier, now)}:${symbol.toUpperCase()}`;
}

export function getCachedSuggestion(tier: AITier, symbol: string): SuggestionRecord | null {
  if (typeof window === "undefined") return null;
  const store = readJson<SuggestionStore>(SUGGESTION_STORAGE_KEY, {});
  const key = buildSuggestionKey(tier, symbol);
  return store[key] ?? null;
}

export function setCachedSuggestion(
  tier: AITier,
  symbol: string,
  suggestion: SuggestionRecord
): void {
  if (typeof window === "undefined") return;
  const store = readJson<SuggestionStore>(SUGGESTION_STORAGE_KEY, {});
  const key = buildSuggestionKey(tier, symbol);
  store[key] = suggestion;
  writeJson(SUGGESTION_STORAGE_KEY, store);
}

export function getCachedMarketSummary(
  tier: AITier,
  signature: string
): Omit<MarketSummaryRecord, "signature" | "cachedAt"> | null {
  if (typeof window === "undefined") return null;
  const store = readJson<MarketSummaryStore>(MARKET_SUMMARY_STORAGE_KEY, {});
  const record = store[tier];
  if (!record) return null;
  if (record.signature !== signature) return null;

  const cachedAtMs = Date.parse(record.cachedAt);
  if (!Number.isFinite(cachedAtMs)) return null;
  if (Date.now() - cachedAtMs > MARKET_SUMMARY_TTL_MS) return null;

  return {
    middayReport: record.middayReport,
    closingReport: record.closingReport,
    generatedAt: record.generatedAt,
  };
}

export function setCachedMarketSummary(
  tier: AITier,
  signature: string,
  summary: {
    middayReport: string;
    closingReport: string;
    generatedAt: string;
  }
): void {
  if (typeof window === "undefined") return;
  const store = readJson<MarketSummaryStore>(MARKET_SUMMARY_STORAGE_KEY, {});
  store[tier] = {
    signature,
    middayReport: summary.middayReport,
    closingReport: summary.closingReport,
    generatedAt: summary.generatedAt,
    cachedAt: new Date().toISOString(),
  };
  writeJson(MARKET_SUMMARY_STORAGE_KEY, store);
}
