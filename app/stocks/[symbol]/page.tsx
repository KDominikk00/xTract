"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { motion, easeOut } from "framer-motion";

interface StockData {
  name: string;
  symbol: string;
  open: number;
  close: number;
  high: number;
  low: number;
  volume: number;
  change: number;
  changePercent: number;
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

      const dummyData: StockData = {
        name: "Tesla, Inc.",
        symbol: stockSymbol,
        open: 250.12,
        close: 255.23,
        high: 260.0,
        low: 248.5,
        volume: 1_500_000,
        change: 5.11,
        changePercent: 2.04,
      };

      const dummyRelated: StockData[] = [
        { name: "Apple Inc.", symbol: "AAPL", open: 150, close: 153, high: 155, low: 149, volume: 2_000_000, change: 3, changePercent: 2 },
        { name: "Microsoft Corp.", symbol: "MSFT", open: 300, close: 305, high: 308, low: 298, volume: 1_200_000, change: 5, changePercent: 1.7 },
        { name: "NVIDIA Corp.", symbol: "NVDA", open: 400, close: 410, high: 415, low: 395, volume: 800_000, change: 10, changePercent: 2.5 },
        { name: "Amazon.com Inc.", symbol: "AMZN", open: 100, close: 102, high: 104, low: 99, volume: 1_500_000, change: 2, changePercent: 1.98 },
      ];

      await new Promise((r) => setTimeout(r, 500));
      setStock(dummyData);
      setRelatedStocks(dummyRelated);
      setLoading(false);
    }

    fetchStock();
  }, [stockSymbol]);

  return (
    <motion.main
      className="max-w-7xl mx-auto px-6 py-16 text-white"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: easeOut }}
    >
      {loading ? (
        <p className="text-center text-gray-400">Loading {stockSymbol} data...</p>
      ) : (
        <>
        <div className="mb-8 text-center md:text-left">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="flex flex-col md:flex-row md:items-baseline gap-4">
                <h1 className="text-4xl font-bold text-blue-500">
                    {stock?.name} ({stock?.symbol})
                </h1>
                <div className="text-white text-2xl font-semibold flex flex-col md:flex-row md:items-baseline gap-2 mt-1 md:mt-0">
                    <span>{stock?.close.toLocaleString()}</span>
                    <span
                    className={`text-lg ${
                        stock?.change != null && stock.change >= 0 ? "text-green-500" : "text-red-500"
                    }`}
                    >
                    {stock?.change != null && stock.change >= 0 ? "+" : ""}
                    {stock?.change} (
                    {stock?.changePercent != null && stock.changePercent >= 0 ? "+" : ""}
                    {stock?.changePercent}%)
                    </span>
                </div>
                </div>

                <button
                className={`pt-8 rounded-full text-2xl transition-colors duration-200
                    ${followed 
                    ? "text-yellow-400 hover:text-yellow-300" 
                    : "text-gray-400 hover:text-yellow-400"}`
                }
                onClick={() => setFollowed(!followed)}
                >
                {followed ? "★" : "☆"}
                </button>
            </div>
        </div>

          <div className="w-full h-96 bg-[#141c2f] rounded-xl shadow-md flex items-center justify-center mb-8">
            <p className="text-gray-500">Candlestick chart will go here</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[
              { label: "Open", value: stock?.open },
              { label: "Close", value: stock?.close },
              { label: "High", value: stock?.high },
              { label: "Low", value: stock?.low },
              { label: "Volume", value: stock?.volume?.toLocaleString() },
            ].map((item) => (
              <div key={item.label} className="p-4 bg-[#0e111a] rounded-xl shadow-md text-center">
                <p className="text-gray-400">{item.label}</p>
                <p className="text-white font-bold">{item.value}</p>
              </div>
            ))}
            <div className="p-4 bg-[#0e111a] rounded-xl shadow-md text-center">
              <p className="text-gray-400">Change</p>
              <p
                className={`font-bold ${
                  stock?.change != null && stock.change >= 0 ? "text-green-500" : "text-red-500"
                }`}
              >
                {stock?.change != null && stock.change >= 0 ? "+" : ""}
                {stock?.change} (
                {stock?.changePercent != null && stock.changePercent >= 0 ? "+" : ""}
                {stock?.changePercent}%)
              </p>
            </div>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-bold text-blue-500 mb-4">Latest News</h2>
            <ul className="space-y-3">
              <li className="p-4 bg-[#141c2f] rounded-xl shadow-md hover:shadow-lg transition-shadow">
                <p className="text-white font-semibold">
                  Tesla announces new electric semi truck
                </p>
                <p className="text-gray-400 text-sm mt-1">source: reuters.com</p>
              </li>
              <li className="p-4 bg-[#141c2f] rounded-xl shadow-md hover:shadow-lg transition-shadow">
                <p className="text-white font-semibold">
                  Tesla stock surges after strong earnings report
                </p>
                <p className="text-gray-400 text-sm mt-1">source: bloomberg.com</p>
              </li>
            </ul>
          </div>

          <div className="p-6 bg-[#0e111a] rounded-xl shadow-md text-center mb-8">
            <p className="text-gray-400">
              You can add charts, analyst ratings, upcoming earnings, or other key insights here.
            </p>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-blue-500 mb-4">Related Stocks</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              {relatedStocks.map((rel) => (
                <div
                  key={rel.symbol}
                  className="p-4 bg-[#0e111a] rounded-xl shadow-md hover:shadow-lg transition-shadow"
                >
                  <div className="flex justify-between items-center mb-2">
                    <div>
                      <p className="text-white font-semibold">{rel.name}</p>
                      <p className="text-gray-400 text-sm">{rel.symbol}</p>
                    </div>
                    <div
                      className={`font-bold ${
                        rel.change >= 0 ? "text-green-500" : "text-red-500"
                      } text-right`}
                    >
                      {rel.close.toLocaleString()}
                    </div>
                  </div>
                  <div className="text-right font-semibold mb-2">
                    <span className={rel.change >= 0 ? "text-green-500" : "text-red-500"}>
                      {rel.change >= 0 ? "+" : ""}
                      {rel.change} ({rel.changePercent >= 0 ? "+" : ""}
                      {rel.changePercent}%)
                    </span>
                  </div>
                  <div className="w-full h-16 bg-[#141c2f] rounded-md flex items-center justify-center">
                    <p className="text-gray-500 text-xs">Mini chart</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </motion.main>
  );
}