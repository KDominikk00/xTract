import "server-only";

const LOCAL_STOCK_API_BASE_URL = "http://localhost:8000";

function trimTrailingSlashes(value: string): string {
  return value.replace(/\/+$/, "");
}

function ensureScheme(value: string): string {
  if (/^https?:\/\//i.test(value)) {
    return value;
  }

  // Support host:port style env values from Render/local setups.
  return `http://${value}`;
}

export function getStockApiBaseUrl(): string {
  const explicitBaseUrl = process.env.STOCK_API_BASE_URL?.trim();
  if (explicitBaseUrl) {
    return trimTrailingSlashes(explicitBaseUrl);
  }

  const hostPort = process.env.STOCK_API_HOSTPORT?.trim();
  if (hostPort) {
    return trimTrailingSlashes(ensureScheme(hostPort));
  }

  return LOCAL_STOCK_API_BASE_URL;
}

export function buildStockApiUrl(pathname: string, searchParams?: URLSearchParams): string {
  const normalizedPath = pathname.startsWith("/") ? pathname : `/${pathname}`;
  const url = new URL(`${getStockApiBaseUrl()}${normalizedPath}`);

  if (searchParams) {
    url.search = searchParams.toString();
  }

  return url.toString();
}

const STOCK_API_TIMEOUT_MS = 15_000;
// Render free instances sleep when idle and can take up to ~a minute to wake. While waking, the edge
// answers 429/502/503/504 (or the connection times out), so retry those instead of failing the page.
const RETRY_DELAYS_MS = [1_500, 3_000, 6_000, 10_000];
const RETRYABLE_STATUSES = new Set([429, 502, 503, 504]);

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Server-to-server call to the stock API: adds the shared secret and a timeout so a slow upstream cannot hang requests.
export async function fetchStockApi(pathname: string, searchParams?: URLSearchParams): Promise<Response> {
  const secret = process.env.STOCK_API_SECRET?.trim();
  const url = buildStockApiUrl(pathname, searchParams);

  for (let attempt = 0; ; attempt += 1) {
    const isLastAttempt = attempt >= RETRY_DELAYS_MS.length;
    try {
      const res = await fetch(url, {
        cache: "no-store",
        headers: secret ? { "X-Stock-Api-Key": secret } : undefined,
        signal: AbortSignal.timeout(STOCK_API_TIMEOUT_MS),
      });
      if (!RETRYABLE_STATUSES.has(res.status) || isLastAttempt) return res;
    } catch (error) {
      if (isLastAttempt) throw error;
    }
    await sleep(RETRY_DELAYS_MS[attempt]);
  }
}

// Upstream error pages (e.g. a plain-text 429) are not JSON; return null instead of throwing.
export async function readJson(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}
