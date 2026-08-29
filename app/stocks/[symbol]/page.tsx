"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import PageLayout from "@/components/PageLayout";
import CandlestickChart from "@/components/CandlestickChart";
import MiniChart from "@/components/MiniChart";
import { useAuth } from "@/lib/AuthProvider";
import {
  createInitialQuotaSnapshot,
  getUserTier,
  type AIQuotaSnapshot,
} from "@/lib/aiPlan";
import {
  getCachedSuggestion,
  setCachedSuggestion,
} from "@/lib/aiQuotaClient";
import { getAccessToken } from "@/lib/getAccessToken";

interface StockData {
  name: string;
  symbol: string;
  currentPrice: number;
  open: number;
  close: number;
  high: number;
  low: number;
  volume: number;
  change: number;
  changePercent: number;
  marketCap?: number;
  previousClose?: number;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
  trailingPE?: number;
  forwardPE?: number;
  dividendYield?: number;
  beta?: number;
  earningsTimestamp?: number;
  earningsDate?: string;
  sector?: string;
  industry?: string;
  description?: string;
}

type AISuggestion = {
  label: "Strong Buy" | "Buy" | "Hold" | "Sell" | "Strong Sell";
  reason: string;
  generatedAt?: string;
};

type SuggestionApiResponse = AISuggestion & {
  quota?: AIQuotaSnapshot;
  error?: string;
};

type FollowedListResponse = {
  followed?: Array<{ symbol: string }>;
  error?: string;
};

const suggestionTone: Record<AISuggestion["label"], string> = {
  "Strong Buy": "text-emerald-400",
  Buy: "text-green-400",
  Hold: "text-yellow-300",
  Sell: "text-orange-300",
  "Strong Sell": "text-red-400",
};

const twoDecimalFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatPrice(value: number) {
  return twoDecimalFormatter.format(value);
}

function formatOptionalNumber(value: number | undefined) {
  return value === undefined ? undefined : twoDecimalFormatter.format(value);
}

function formatWholeNumber(value: number | undefined) {
  return value === undefined
    ? undefined
    : value.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

export default function StockPage() {
  const params = useParams();
  const router = useRouter();
  const symbolParam = Array.isArray(params.symbol) ? params.symbol[0] : params.symbol;
  const stockSymbol = symbolParam?.toUpperCase() || "TBD";
  const { user } = useAuth();
  const tier = useMemo(() => getUserTier(user), [user]);

  const [stock, setStock] = useState<StockData | null>(null);
  const [loading, setLoading] = useState(true);
  const [relatedStocks, setRelatedStocks] = useState<StockData[]>([]);
  const [followed, setFollowed] = useState(false);
  const [followingBusy, setFollowingBusy] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<AISuggestion | null>(null);
  const [aiStatus, setAiStatus] = useState<"idle" | "loading" | "ready" | "limited" | "error">("idle");
  const [quota, setQuota] = useState<AIQuotaSnapshot>(() => createInitialQuotaSnapshot(tier));
  const suggestionsExhausted = user && quota.remainingSuggestions === 0;

  useEffect(() => {
    setQuota(createInitialQuotaSnapshot(tier));
  }, [tier]);

  useEffect(() => {
    if (!user) return;

    async function fetchQuota() {
      try {
        const accessToken = await getAccessToken();
        if (!accessToken) return;

        const res = await fetch("/api/ai/quota", {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });
        const data = (await res.json()) as { quota?: AIQuotaSnapshot };
        if (res.ok && data.quota) {
          setQuota(data.quota);
        }
      } catch (err) {
        console.error("Failed to fetch AI quota:", err);
      }
    }

    void fetchQuota();
  }, [user, tier, stockSymbol]);

  useEffect(() => {
    if (!user) {
      setFollowed(false);
      return;
    }

    async function fetchFollowedStatus() {
      try {
        const accessToken = await getAccessToken();
        if (!accessToken) return;

        const res = await fetch("/api/followed", {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });
        const data = (await res.json()) as FollowedListResponse;
        if (!res.ok || !Array.isArray(data.followed)) return;
        const isFollowed = data.followed.some((item) => item.symbol === stockSymbol);
        setFollowed(isFollowed);
      } catch (err) {
        console.error("Failed to load followed status:", err);
      }
    }

    void fetchFollowedStatus();
  }, [user, stockSymbol]);

  useEffect(() => {
    async function fetchStock() {
      setLoading(true);
      try {
        const res = await fetch(`/stocks/api/${stockSymbol}`);
        if (!res.ok) throw new Error("Failed to fetch stock data");
        const data: StockData = await res.json();
        setStock(data);
      } catch (err) {
        console.error(err);
        setStock(null);
      } finally {
        setLoading(false);
      }
    }

    async function fetchRecommendedStocks() {
      // Recommendations are optional and must not invalidate the primary stock result.
      const allSymbols = ["AAPL", "JPM", "XOM", "KO", "JNJ", "TSLA", "BAC", "CVX", "PG", "PFE", "V", "MA", "DIS", "NFLX", "WMT", "MCD"];
      const recommendedSymbols = allSymbols
        .filter((candidate) => candidate !== stockSymbol)
        .sort(() => 0.5 - Math.random())
        .slice(0, 4);

      const results = await Promise.allSettled(
        recommendedSymbols.map(async (recommendedSymbol) => {
          const res = await fetch(`/stocks/api/${recommendedSymbol}`);
          if (!res.ok) throw new Error(`Failed to fetch stock ${recommendedSymbol}`);
          return (await res.json()) as StockData;
        })
      );

      setRelatedStocks(
        results
          .filter((result): result is PromiseFulfilledResult<StockData> => result.status === "fulfilled")
          .map((result) => result.value)
      );
    }

    void fetchStock();
    void fetchRecommendedStocks();
  }, [stockSymbol]);

  useEffect(() => {
    if (!stock) return;
    // Snapshot avoids stale symbol reads if route changes while async work is in flight.
    const currentStock = stock;
    if (!user) {
      setAiStatus("limited");
      setAiSuggestion(null);
      return;
    }

    // Suggestion cache key is scoped by tier+quota window to avoid stale cross-plan reuse.
    const cached = getCachedSuggestion(tier, currentStock.symbol);
    if (cached) {
      setAiSuggestion({
        label: cached.label as AISuggestion["label"],
        reason: cached.reason,
        generatedAt: cached.generatedAt,
      });
      setAiStatus("ready");
      return;
    }

    async function fetchSuggestion() {
      setAiStatus("loading");
      try {
        const accessToken = await getAccessToken();
        if (!accessToken) {
          setAiStatus("limited");
          return;
        }

        const res = await fetch("/api/ai/suggestion", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            symbol: currentStock.symbol,
            stock: {
              name: currentStock.name,
              symbol: currentStock.symbol,
              currentPrice: currentStock.currentPrice,
              open: currentStock.open,
              close: currentStock.close,
              high: currentStock.high,
              low: currentStock.low,
              volume: currentStock.volume,
              change: currentStock.change,
              changePercent: currentStock.changePercent,
              marketCap: currentStock.marketCap,
              trailingPE: currentStock.trailingPE,
              forwardPE: currentStock.forwardPE,
              dividendYield: currentStock.dividendYield,
              beta: currentStock.beta,
              sector: currentStock.sector,
              industry: currentStock.industry,
            },
          }),
        });

        const data = (await res.json()) as SuggestionApiResponse;
        if (data.quota) {
          setQuota(data.quota);
        }

        if (res.status === 429) {
          setAiSuggestion(null);
          setAiStatus("limited");
          return;
        }

        if (!res.ok || !data.label || !data.reason) {
          throw new Error(data.error ?? "Failed to load AI suggestion");
        }

        setAiSuggestion(data);
        setAiStatus("ready");
        setCachedSuggestion(tier, currentStock.symbol, {
          label: data.label,
          reason: data.reason,
          generatedAt: data.generatedAt ?? new Date().toISOString(),
        });
      } catch (err) {
        console.error("AI suggestion error:", err);
        setAiStatus("error");
      }
    }

    void fetchSuggestion();
  }, [stock, tier, user]);

  if (loading) return (
    <PageLayout className="mx-auto max-w-7xl px-4 py-10 text-white sm:px-6 sm:py-14">
      <p className="text-center text-gray-400">Loading {stockSymbol} data...</p>
    </PageLayout>
  );

  if (!stock) return (
    <PageLayout className="mx-auto max-w-7xl px-4 py-10 text-white sm:px-6 sm:py-14">
      <p className="text-center text-red-500">Failed to load stock data.</p>
    </PageLayout>
  );

  async function toggleFollowed() {
    if (!user) {
      router.push("/login");
      return;
    }
    if (followingBusy) return;

    try {
      setFollowingBusy(true);
      const accessToken = await getAccessToken();
      if (!accessToken) return;

      const method = followed ? "DELETE" : "POST";
      const res = await fetch("/api/followed", {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ symbol: stockSymbol }),
      });

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? "Unable to update followed stocks.");
      }

      setFollowed((prev) => !prev);
    } catch (err) {
      console.error("Follow update failed:", err);
    } finally {
      setFollowingBusy(false);
    }
  }

  return (
    <PageLayout className="mx-auto max-w-7xl px-4 pt-8 pb-12 text-white sm:px-6 sm:pt-12">
      <div className="mb-8 text-left sm:mb-12">
        <div className="mb-6 flex flex-col gap-4 sm:mb-10 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
          <div className="min-w-0 space-y-2">
            <h1 className="wrap-break-word text-2xl font-bold text-blue-500 sm:text-4xl">
            {stock.name} ({stock.symbol})
            </h1>

            <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1 font-semibold text-white">
              <span className="text-xl sm:text-2xl">${formatPrice(stock.currentPrice)}</span>
              <span className={`text-lg sm:text-xl ${stock.change >= 0 ? "text-green-500" : "text-red-500"}`}>
                {stock.change >= 0 ? "+" : ""}
                {stock.change.toFixed(2)} ({stock.changePercent >= 0 ? "+" : ""}
                {stock.changePercent.toFixed(2)}%)
              </span>
            </div>
          </div>

          <button
            className={`shrink-0 self-start whitespace-nowrap rounded-full text-2xl transition-colors duration-200 sm:self-auto sm:text-3xl ${
              followed ? "text-yellow-400 hover:text-yellow-300" : "text-gray-400 hover:text-yellow-400"
            }`}
            onClick={toggleFollowed}
            disabled={!user || followingBusy}
            aria-label={followed ? "Unfollow stock" : "Follow stock"}
          >
            {followed ? "★" : "☆"}
          </button>
        </div>
      </div>

      <div id="container" className="mb-6 h-80 w-full rounded-xl shadow-md sm:mb-8 sm:h-120 lg:h-136">
        <CandlestickChart />
      </div>

      <div className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Open", value: formatPrice(stock.open) },
          { label: "Close", value: formatPrice(stock.close) },
          { label: "High", value: formatPrice(stock.high) },
          { label: "Low", value: formatPrice(stock.low) },
          { label: "Volume", value: formatWholeNumber(stock.volume) },
          { label: "Market Cap", value: formatWholeNumber(stock.marketCap) },
          { label: "Previous Close", value: formatOptionalNumber(stock.previousClose) },
        ].map(item => item.value != null && (
          <div key={item.label} className="flex h-full min-h-36 flex-col items-center justify-center rounded-xl bg-[#0e111a] p-4 text-center shadow-md">
            <p className="text-sm text-gray-400">{item.label}</p>
            <p className="mt-1 wrap-break-word text-sm font-bold text-white sm:text-base">{item.value}</p>
          </div>
        ))}
        <div className="flex h-full min-h-39 flex-col items-center justify-center rounded-xl bg-[#0e111a] p-4 text-center shadow-md">
          <p className="text-sm text-gray-400">Change</p>
          <p className={`mt-1 wrap-break-word text-sm font-bold sm:text-base ${stock.change >= 0 ? "text-green-500" : "text-red-500"}`}>
            {stock.change >= 0 ? "+" : ""}{stock.change.toFixed(2)} ({stock.changePercent >= 0 ? "+" : ""}{stock.changePercent.toFixed(2)}%)
          </p>
        </div>
        <div className="flex h-full min-h-39 flex-col items-center justify-center rounded-xl bg-[#1a274d] p-4 text-center shadow-md">
          <p className="text-sm text-gray-400">AI Suggestion</p>
          {aiStatus === "loading" ? (
            <strong className="text-blue-300">Analyzing...</strong>
          ) : aiStatus === "limited" ? (
            <strong className="text-yellow-300">{user ? "Quota reached" : "Sign in required"}</strong>
          ) : aiStatus === "error" ? (
            <strong className="text-red-300">Unavailable</strong>
          ) : aiSuggestion ? (
            <strong className={suggestionTone[aiSuggestion.label]}>{aiSuggestion.label}</strong>
          ) : (
            <strong className="text-gray-300">No signal</strong>
          )}
          <p className="mt-2 text-xs text-gray-300">
            {aiSuggestion?.reason ??
              (user
                ? "Informational insight only. Not financial advice."
                : "Log in to unlock AI stock suggestions.")}
          </p>
          <p className="mt-2 text-[11px] text-gray-400">
            {quota.remainingSuggestions === null
              ? "Unlimited suggestions"
              : `${quota.remainingSuggestions} suggestions left this ${
                  quota.resetWindow === "daily" ? "day" : "month"
                }`}
          </p>
          {suggestionsExhausted ? (
            <Link
              href="/"
              className="mt-3 inline-flex rounded-full border border-amber-300 bg-amber-500/20 px-3 py-1 text-xs font-semibold text-amber-200 hover:bg-amber-500/30"
            >
              Upgrade for more AI suggestions
            </Link>
          ) : null}
        </div>
      </div>

      <div className="mb-8 rounded-xl bg-[#141c2f] p-5 shadow-md sm:p-6">
        <h2 className="text-2xl font-bold text-blue-500 mb-4">Fundamentals</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "52W High", value: formatOptionalNumber(stock.fiftyTwoWeekHigh) },
            { label: "52W Low", value: formatOptionalNumber(stock.fiftyTwoWeekLow) },
            { label: "Trailing P/E", value: formatOptionalNumber(stock.trailingPE) },
            { label: "Forward P/E", value: formatOptionalNumber(stock.forwardPE) },
            { label: "Dividend Yield", value: formatOptionalNumber(stock.dividendYield) },
            { label: "Beta", value: formatOptionalNumber(stock.beta) },
            { label: "Earnings Date", value: stock.earningsDate },
            { label: "Sector", value: stock.sector },
            { label: "Industry", value: stock.industry },
            { label: "Description", value: stock.description },
          ].map(item => item.value != null && (
            <div
              key={item.label}
              className={`rounded-xl bg-[#0e111a] p-4 shadow-md ${
                item.label === "Description" ? "sm:col-span-2 lg:col-span-4" : ""
              }`}
            >
              <p className="text-gray-400 text-sm">{item.label}</p>
              <p className="wrap-break-word text-sm font-semibold text-white">{item.value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mb-2 sm:mb-10">
        <h2 className="text-2xl font-bold text-blue-500 mb-4">Recommended Stocks</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {relatedStocks.map((rel) => (
            <Link
              key={rel.symbol}
              href={`/stocks/${rel.symbol}`}
              className="p-4 bg-[#0e111a] rounded-xl shadow-md hover:shadow-lg transition-shadow flex flex-col hover:bg-[#141c2f] cursor-pointer"
            >
              <div className="mb-2 flex items-start justify-between gap-3">
                <div className="min-h-12 min-w-0">
                  <p className="line-clamp-2 wrap-break-word font-semibold leading-snug text-white">
                    {rel.name}
                  </p>
                  <p className="text-gray-400 text-sm">{rel.symbol}</p>
                </div>
                <div
                  className={`shrink-0 text-sm font-bold sm:text-base ${
                    rel.change >= 0 ? "text-green-500" : "text-red-500"
                  }`}
                >
                  ${formatPrice(rel.close)}
                </div>
              </div>

              <div className="text-right font-semibold mb-2">
                <span
                  className={rel.change >= 0 ? "text-green-500" : "text-red-500"}
                >
                  {rel.change >= 0 ? "+" : ""}
                  {rel.change.toFixed(2)} (
                  {rel.changePercent >= 0 ? "+" : ""}
                  {rel.changePercent.toFixed(2)}%)
                </span>
              </div>

              <div className="w-full h-40 bg-[#141c2f] rounded-md flex items-center justify-center mt-auto">
                <MiniChart symbol={rel.symbol} />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </PageLayout>
  );
}
