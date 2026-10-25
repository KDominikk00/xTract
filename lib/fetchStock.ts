// FetchStock.ts
import { trackSlowRequest } from "@/lib/wakeStatus";

export type Stock = {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  exchange: string;
};

export type NewsArticle = {
  title: string;
  link: string;
  site: string;
  publishedDate: string;
  image?: string;
  text?: string;
};

export type MarketSummary = {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
};

export type Candle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
};

type ApiRecord = Record<string, unknown>;

const LOCAL_APP_URL = "http://localhost:3000";

function isRecord(value: unknown): value is ApiRecord {
  return typeof value === "object" && value !== null;
}

function toNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function getAppBaseUrl(): string {
  // Browser calls should follow the active origin; server calls need an absolute fallback URL.
  if (typeof window !== "undefined") {
    return window.location.origin.replace(/\/+$/, "");
  }

  return (process.env.NEXT_PUBLIC_APP_URL || LOCAL_APP_URL).replace(/\/+$/, "");
}

function toAppUrl(pathname: string): string {
  const path = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return `${getAppBaseUrl()}${path}`;
}

// The hosting plan puts idle services to sleep, so the first requests after a quiet period can fail
// for up to a minute while they wake. Retry transient failures instead of leaving the page broken.
const CLIENT_RETRY_DELAYS_MS = [3_000, 6_000, 10_000, 15_000];
const RETRYABLE_STATUSES = new Set([429, 502, 503, 504]);

function wait(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException("Aborted", "AbortError"));
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(new DOMException("Aborted", "AbortError"));
      },
      { once: true }
    );
  });
}

// Fetch for any market-data route: retries transient failures and drives the "server is waking up" notice.
export function fetchMarketData(url: string, init: RequestInit = {}): Promise<Response> {
  // Shows the "server is waking up" notice if this takes longer than a few seconds.
  return trackSlowRequest(() => fetchWithRetryInner(url, init));
}

async function fetchWithRetryInner(url: string, init: RequestInit): Promise<Response> {
  for (let attempt = 0; ; attempt += 1) {
    const isLastAttempt = attempt >= CLIENT_RETRY_DELAYS_MS.length;
    try {
      const res = await fetch(url, { cache: "no-store", ...init });
      if (!RETRYABLE_STATUSES.has(res.status) || isLastAttempt) return res;
    } catch (error) {
      // Never retry a request the caller cancelled.
      if (isLastAttempt || (error instanceof DOMException && error.name === "AbortError")) throw error;
    }
    await wait(CLIENT_RETRY_DELAYS_MS[attempt], init.signal ?? undefined);
  }
}

async function fetchStocks(endpoint: string, limit?: number): Promise<Stock[]> {
  const url = new URL(toAppUrl(`/api/stocks/${endpoint}`));
  if (limit) url.searchParams.set("n", limit.toString());

  const res = await fetchMarketData(url.toString());
  if (!res.ok) throw new Error(`Failed to fetch ${endpoint}`);

  const data: unknown = await res.json();
  if (!Array.isArray(data)) return [];

  return data
    .filter(isRecord)
    .map((stock) => ({
      symbol: toString(stock.symbol),
      name: toString(stock.name),
      price: toNumber(stock.price),
      change: toNumber(stock.change),
      changePercent: toNumber(stock.changePercent ?? stock.changesPercentage),
      exchange: toString(stock.exchange),
    }));
}

export async function getGainers(limit?: number): Promise<Stock[]> {
  return fetchStocks("gainers", limit);
}

export async function getLosers(limit?: number): Promise<Stock[]> {
  return fetchStocks("losers", limit);
}

export async function getNews(limit?: number): Promise<NewsArticle[]> {
  const url = new URL(toAppUrl("/api/stocks/news"));
  if (limit) url.searchParams.set("n", limit.toString());

  const res = await fetchMarketData(url.toString());
  if (!res.ok) throw new Error("Failed to fetch news");

  const data: unknown = await res.json();
  if (!Array.isArray(data)) return [];

  return data
    .filter(isRecord)
    .map((item) => ({
      title: toString(item.title),
      link: toString(item.link),
      site: toString(item.site ?? item.source),
      publishedDate: toString(item.publishedDate ?? item.date),
      image: toString(item.image),
      text: toString(item.text ?? item.description),
    }));
}

export async function getSummary(): Promise<MarketSummary[]> {
  const res = await fetchMarketData(toAppUrl("/api/stocks/summary-data"));
  if (!res.ok) throw new Error("Failed to fetch market summary");
  return res.json();
}

export async function getHistory(
  symbol: string,
  period: string,
  interval: string,
  signal?: AbortSignal
): Promise<Candle[]> {
  const path = `/api/stocks/history/${encodeURIComponent(symbol)}?period=${encodeURIComponent(period)}&interval=${encodeURIComponent(interval)}`;
  const res = await fetchMarketData(toAppUrl(path), { signal });
  const data: unknown = await res.json().catch(() => null);

  if (!res.ok) {
    if (isRecord(data) && typeof data.detail === "string") {
      throw new Error(data.detail);
    }
    throw new Error(`Failed to fetch history for ${symbol}`);
  }

  if (!Array.isArray(data)) {
    throw new Error(`Unexpected history response for ${symbol}`);
  }

  const candles = data.filter(isRecord).map((row) => ({
    time: toNumber(row.time),
    open: toNumber(row.open),
    high: toNumber(row.high),
    low: toNumber(row.low),
    close: toNumber(row.close),
  }));

  if (!candles.length) {
    throw new Error(`No historical data is available for ${symbol}`);
  }

  return candles;
}
