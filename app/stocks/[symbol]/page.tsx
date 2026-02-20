"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import PageLayout from "@/components/PageLayout";
import CandlestickChart from "@/components/CandlestickChart";

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

export default function StockPage() {
  const params = useParams();
  const symbolParam = Array.isArray(params.symbol) ? params.symbol[0] : params.symbol;
  const stockSymbol = symbolParam?.toUpperCase() || "TBD";

  const [stock, setStock] = useState<StockData | null>(null);
  const [loading, setLoading] = useState(true);
  const [relatedStocks, setRelatedStocks] = useState<StockData[]>([]);
  const [followed, setFollowed] = useState(false);

  useEffect(() => {
    async function fetchStock() {
      setLoading(true);
      try {
        const res = await fetch(`/stocks/api/${stockSymbol}`);
        if (!res.ok) throw new Error("Failed to fetch stock data");
        const data: StockData = await res.json();
        setStock(data);

        const relatedSymbols = ["AAPL", "MSFT", "NVDA", "AMZN"].filter(s => s !== stockSymbol);
        const relatedData: StockData[] = await Promise.all(
          relatedSymbols.map(async (sym) => {
            const r = await fetch(`/stocks/api/${sym}`);
            if (!r.ok) throw new Error("Failed to fetch related stock");
            return r.json();
          })
        );
        setRelatedStocks(relatedData);
      } catch (err) {
        console.error(err);
        setStock(null);
        setRelatedStocks([]);
      } finally {
        setLoading(false);
      }
    }

    fetchStock();
  }, [stockSymbol]);

  if (loading) return <PageLayout className="max-w-7xl mx-auto px-6 py-16 text-white">
    <p className="text-center text-gray-400">Loading {stockSymbol} data...</p>
  </PageLayout>;

  if (!stock) return <PageLayout className="max-w-7xl mx-auto px-6 py-16 text-white">
    <p className="text-center text-red-500">Failed to load stock data.</p>
  </PageLayout>;

  return (
    <PageLayout className="max-w-7xl mx-auto px-6 py-16 text-white">

      <div className="mb-14 text-center md:text-left">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex flex-col md:flex-row md:items-baseline gap-4">
            <h1 className="text-4xl font-bold text-blue-500">{stock.name} ({stock.symbol})</h1>
            <div className="text-white text-2xl font-semibold flex flex-col md:flex-row md:items-baseline gap-2 mt-1 md:mt-0">
              <span>${stock.currentPrice.toLocaleString()}</span>
              <span className={`text-lg ${stock.change >= 0 ? "text-green-500" : "text-red-500"}`}>
                {stock.change >= 0 ? "+" : ""}{stock.change.toFixed(2)} ({stock.changePercent >= 0 ? "+" : ""}{stock.changePercent.toFixed(2)}%)
              </span>
            </div>
          </div>
          <button
            className={`pt-8 rounded-full text-2xl transition-colors duration-200 ${
              followed ? "text-yellow-400 hover:text-yellow-300" : "text-gray-400 hover:text-yellow-400"
            }`}
            onClick={() => setFollowed(!followed)}
          >
            {followed ? "★" : "☆"}
          </button>
        </div>
      </div>

      <div id="container" className="w-full h-96 rounded-xl shadow-md flex items-center justify-center mb-8">
        {/* <p className="text-gray-500">Candlestick chart will go here</p> */}
        <CandlestickChart></CandlestickChart>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Open", value: stock.open },
          { label: "Close", value: stock.close },
          { label: "High", value: stock.high },
          { label: "Low", value: stock.low },
          { label: "Volume", value: stock.volume.toLocaleString() },
          { label: "Market Cap", value: stock.marketCap?.toLocaleString() },
          { label: "Previous Close", value: stock.previousClose },
        ].map(item =>
          item.value != null && (
            <div key={item.label} className="p-4 bg-[#0e111a] rounded-xl shadow-md text-center">
              <p className="text-gray-400">{item.label}</p>
              <p className="text-white font-bold">{item.value}</p>
            </div>
          )
        )}
        <div className="p-4 bg-[#0e111a] rounded-xl shadow-md text-center">
          <p className="text-gray-400">Change</p>
          <p className={`font-bold ${stock.change >= 0 ? "text-green-500" : "text-red-500"}`}>
            {stock.change >= 0 ? "+" : ""}{stock.change.toFixed(2)} ({stock.changePercent >= 0 ? "+" : ""}{stock.changePercent.toFixed(2)}%)
          </p>
        </div>
      </div>

      <div className="mb-8 p-6 bg-[#141c2f] rounded-xl shadow-md">
        <h2 className="text-2xl font-bold text-blue-500 mb-4">Fundamentals</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "52W High", value: stock.fiftyTwoWeekHigh },
            { label: "52W Low", value: stock.fiftyTwoWeekLow },
            { label: "Trailing P/E", value: stock.trailingPE },
            { label: "Forward P/E", value: stock.forwardPE },
            { label: "Dividend Yield", value: stock.dividendYield },
            { label: "Beta", value: stock.beta },
            { label: "Earnings Date", value: stock.earningsDate },
            { label: "Sector", value: stock.sector },
            { label: "Industry", value: stock.industry },
            { label: "Description", value: stock.description },
          ].map(item =>
            item.value != null && (
              <div key={item.label} className="p-4 bg-[#0e111a] rounded-xl shadow-md">
                <p className="text-gray-400 text-sm">{item.label}</p>
                <p className="text-white text-sm font-semibold">{item.value}</p>
              </div>
            )
          )}
        </div>
      </div>

      <div className="mb-8">
        <h2 className="text-2xl font-bold text-blue-500 mb-4">Latest News</h2>
        <ul className="space-y-3">
          <li className="p-4 bg-[#141c2f] rounded-xl shadow-md hover:shadow-lg transition-shadow">
            <p className="text-white font-semibold">News item 1 about {stock.symbol}</p>
            <p className="text-gray-400 text-sm mt-1">source: reuters.com</p>
          </li>
          <li className="p-4 bg-[#141c2f] rounded-xl shadow-md hover:shadow-lg transition-shadow">
            <p className="text-white font-semibold">News item 2 about {stock.symbol}</p>
            <p className="text-gray-400 text-sm mt-1">source: bloomberg.com</p>
          </li>
        </ul>
      </div>

      <div>
        <h2 className="text-2xl font-bold text-blue-500 mb-4">Related Stocks</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {relatedStocks.map(rel => (
            <div key={rel.symbol} className="p-4 bg-[#0e111a] rounded-xl shadow-md hover:shadow-lg transition-shadow">
              <div className="flex justify-between items-center mb-2">
                <div>
                  <p className="text-white font-semibold">{rel.name}</p>
                  <p className="text-gray-400 text-sm">{rel.symbol}</p>
                </div>
                <div className={`font-bold ${rel.change >= 0 ? "text-green-500" : "text-red-500"}`}>
                  {rel.close.toLocaleString()}
                </div>
              </div>
              <div className="text-right font-semibold mb-2">
                <span className={rel.change >= 0 ? "text-green-500" : "text-red-500"}>
                  {rel.change >= 0 ? "+" : ""}{rel.change} ({rel.changePercent >= 0 ? "+" : ""}{rel.changePercent}%)
                </span>
              </div>
              <div className="w-full h-16 bg-[#141c2f] rounded-md flex items-center justify-center">
                <p className="text-gray-500 text-xs">Mini chart</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </PageLayout>
  );
}