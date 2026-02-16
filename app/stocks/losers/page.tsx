"use client";

import { motion, easeOut } from "framer-motion";

interface Stock {
  name: string;
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
}

const rowVariants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: easeOut } },
};

export default function TopLosersPage() {
  const stocks: Stock[] = [
    { name: "Twitter Inc.", symbol: "TWTR", price: 45, change: -3, changePercent: -6.25, volume: 900000 },
    { name: "Peloton Interactive", symbol: "PTON", price: 28, change: -2, changePercent: -6.67, volume: 700000 },
    { name: "Netflix Inc.", symbol: "NFLX", price: 380, change: -15, changePercent: -3.8, volume: 400000 },
    { name: "Meta Platforms", symbol: "META", price: 220, change: -6, changePercent: -2.66, volume: 600000 },
  ];

  return (
    <motion.main
      className="max-w-7xl mx-auto px-6 py-16 text-white"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: easeOut }}
    >
      <h1 className="text-4xl font-bold text-blue-500 mb-8">Top Losers Today</h1>

      <div className="overflow-x-auto">
        <table className="min-w-full table-auto border-collapse">
          <thead className="bg-[#141c2f] text-left text-gray-400">
            <tr>
              <th className="px-4 py-2">Symbol</th>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Price</th>
              <th className="px-4 py-2">Change</th>
              <th className="px-4 py-2">% Change</th>
              <th className="px-4 py-2">Volume</th>
            </tr>
          </thead>
          <tbody>
            {stocks.map((stock) => (
              <motion.tr
                key={stock.symbol}
                className="border-b border-[#1a1f2a] hover:bg-[#1f2535] cursor-pointer"
                variants={rowVariants}
              >
                <td className="px-4 py-3 text-blue-500 font-semibold">{stock.symbol}</td>
                <td className="px-4 py-3">{stock.name}</td>
                <td className="px-4 py-3 font-semibold">${stock.price.toLocaleString()}</td>
                <td className={`px-4 py-3 font-semibold ${stock.change >= 0 ? "text-green-500" : "text-red-500"}`}>
                  {stock.change >= 0 ? "+" : ""}{stock.change}
                </td>
                <td className={`px-4 py-3 font-semibold ${stock.changePercent >= 0 ? "text-green-500" : "text-red-500"}`}>
                  {stock.changePercent >= 0 ? "+" : ""}{stock.changePercent}%
                </td>
                <td className="px-4 py-3">{stock.volume.toLocaleString()}</td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    </motion.main>
  );
}