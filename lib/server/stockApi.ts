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

// Server-to-server call to the stock API: adds the shared secret and a timeout so a slow upstream cannot hang requests.
export function fetchStockApi(pathname: string, searchParams?: URLSearchParams): Promise<Response> {
  const secret = process.env.STOCK_API_SECRET?.trim();
  return fetch(buildStockApiUrl(pathname, searchParams), {
    cache: "no-store",
    headers: secret ? { "X-Stock-Api-Key": secret } : undefined,
    signal: AbortSignal.timeout(STOCK_API_TIMEOUT_MS),
  });
}
