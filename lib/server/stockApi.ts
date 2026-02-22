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

  throw new Error("Missing STOCK_API_BASE_URL or STOCK_API_HOSTPORT");
}

export function buildStockApiUrl(pathname: string, searchParams?: URLSearchParams): string {
  const normalizedPath = pathname.startsWith("/") ? pathname : `/${pathname}`;
  const url = new URL(`${getStockApiBaseUrl()}${normalizedPath}`);

  if (searchParams) {
    url.search = searchParams.toString();
  }

  return url.toString();
}
