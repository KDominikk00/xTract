// FetchStock.ts
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

async function fetchStocks(endpoint: string, limit?: number): Promise<Stock[]> {
  const url = new URL(`http://localhost:8000/stocks/${endpoint}`);
  if (limit) url.searchParams.set("n", limit.toString());

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Failed to fetch ${endpoint}`);

  const data = await res.json();

  return (data || []).map((stock: any) => ({
    symbol: stock.symbol,
    name: stock.name,
    price: Number(stock.price),
    change: Number(stock.change),
    changePercent: Number(stock.changePercent ?? stock.changesPercentage ?? 0),
    exchange: stock.exchange ?? "",
  }));
}

export async function getGainers(limit?: number): Promise<Stock[]> {
  return fetchStocks("gainers", limit);
}

export async function getLosers(limit?: number): Promise<Stock[]> {
  return fetchStocks("losers", limit);
}

export async function getNews(limit?: number): Promise<NewsArticle[]> {
  const url = new URL(`http://localhost:8000/stocks/news`);
  if (limit) url.searchParams.set("n", limit.toString());

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error("Failed to fetch news");

  const data = await res.json();
  return data.map((item: any) => ({
    title: item.title,
    link: item.link,
    site: item.site ?? item.source ?? "",
    publishedDate: item.publishedDate ?? item.date ?? "",
    image: item.image ?? "",
    text: item.text ?? item.description ?? "",
  }));
}

export async function getSummary(): Promise<MarketSummary[]> {
  const res = await fetch(`http://localhost:8000/stocks/summary-data`);
  if (!res.ok) throw new Error("Failed to fetch market summary");
  return res.json();
}

export async function getHistory(
  symbol: string,
  period: string,
  interval: string
): Promise<Candle[]> {
  const res = await fetch(
    `http://localhost:8000/stocks/history/${symbol}?period=${period}&interval=${interval}`
  );
  if (!res.ok) throw new Error(`Failed to fetch history for ${symbol}`);
  return res.json();
}

