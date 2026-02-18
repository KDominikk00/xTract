"use client";

import { useEffect, useState } from "react";
import PageLayout from "@/components/PageLayout";
import { motion, easeOut } from "framer-motion";
import { useRouter } from "next/navigation";

interface Stock {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  exchange: string;
}

const rowVariants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: easeOut } },
};

export default function TopLosersPage() {
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    async function fetchLosers() {
      try {
        setLoading(true);

        const res = await fetch("http://localhost:8000/stocks/losers");
        if (!res.ok) throw new Error("Failed to fetch losers");

        const data: any[] = await res.json();

        const mapped: Stock[] = data.map((s) => ({
          symbol: s.symbol,
          name: s.name,
          price: Number(s.price),
          change: Number(s.change),
          changePercent: Number(s.changesPercentage),
          exchange: s.exchange,
        }));

        setStocks(mapped);
      } catch (err) {
        console.error("Error fetching losers:", err);
        setStocks([]);
      } finally {
        setLoading(false);
      }
    }

    fetchLosers();
  }, []);

  const handleRowClick = (symbol: string) => {
    router.push(`/stocks/${symbol}`);
  };

  return (
    <PageLayout className="max-w-7xl mx-auto px-6 py-16 text-white">
      <h1 className="text-4xl font-bold text-blue-500 mb-8">Top Losers Today</h1>

      {loading ? (
        <p>Loading...</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full table-auto border-collapse">
            <thead className="bg-[#141c2f] text-left text-gray-400">
              <tr>
                <th className="px-4 py-2">Symbol</th>
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2">Price</th>
                <th className="px-4 py-2">Change</th>
                <th className="px-4 py-2">% Change</th>
                <th className="px-4 py-2">Exchange</th>
              </tr>
            </thead>
            <tbody>
              {stocks.map((stock) => (
                <motion.tr
                  key={stock.symbol}
                  className="border-b border-[#1a1f2a] hover:bg-[#1f2535] cursor-pointer"
                  variants={rowVariants}
                  initial="hidden"
                  animate="show"
                  onClick={() => handleRowClick(stock.symbol)}
                >
                  <td className="px-4 py-3 text-blue-500 font-semibold">{stock.symbol}</td>
                  <td className="px-4 py-3">{stock.name}</td>
                  <td className="px-4 py-3 font-semibold">${stock.price.toFixed(2)}</td>
                  <td
                    className={`px-4 py-3 font-semibold ${
                      stock.change >= 0 ? "text-green-500" : "text-red-500"
                    }`}
                  >
                    {stock.change >= 0 ? "+" : ""}
                    {stock.change.toFixed(2)}
                  </td>
                  <td
                    className={`px-4 py-3 font-semibold ${
                      stock.changePercent >= 0 ? "text-green-500" : "text-red-500"
                    }`}
                  >
                    {stock.changePercent >= 0 ? "+" : ""}
                    {stock.changePercent.toFixed(2)}%
                  </td>
                  <td className="px-4 py-3">{stock.exchange}</td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PageLayout>
  );
}