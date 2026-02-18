export type Stock = {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  exchange: string;
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
    changePercent: Number(stock.changesPercentage),
    exchange: stock.exchange,
  }));
}

export async function getGainers(limit?: number): Promise<Stock[]> {
  return fetchStocks("gainers", limit);
}

export async function getLosers(limit?: number): Promise<Stock[]> {
  return fetchStocks("losers", limit);
}