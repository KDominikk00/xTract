"use client";

import { motion, easeOut } from "framer-motion";
import Link from "next/link";

const containerVariants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.15,
    },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: easeOut } },
};

export default function Home() {
  return (
    <motion.main
      className="grid grid-cols-1 md:grid-cols-4 gap-2 bg-(--color-bg) min-h-2 sm:max-w-5xl m-4 my-20 sm:m-24 sm:mx-auto"
      initial="hidden"
      animate="show"
      variants={containerVariants}
    >
      <Link 
      href="/followed" 
      className="sm:col-span-4 min-h-56 border border-blue-500 rounded-xl shadow-md p-6 bg-linear-to-br from-[#0e111a] to-[#1a1f2a] text-white hover:shadow-lg transition-shadow"
>
      <motion.div
      variants={cardVariants}
      >
        <h2 className="text-2xl font-bold mb-4 text-blue-500">Followed Stocks</h2>
        <ul className="space-y-2">
          <li className="text-gray-500">
            Follow stocks to get live updates and notifications
          </li>
        </ul>
      </motion.div>
      </Link>

      <Link
        href="/news"
        className="block sm:col-span-3 min-h-56 border border-blue-500 rounded-xl shadow-md p-6 
                  bg-linear-to-br from-[#0e111a] to-[#1a1f2a] text-white hover:shadow-lg 
                  transition-shadow cursor-pointer"
      >
        <motion.div variants={cardVariants}>
          <div>
            <h2 className="text-2xl font-bold mb-4 text-blue-500">Trending News</h2>
            <ul className="space-y-4 text-xl">
              <li>
                Market rallies as tech stocks climb{" "}
                <span className="text-gray-500 text-xs block sm:inline sm:ml-2">thedailywire.com</span>
              </li>
              <li>
                Federal Reserve announces new policy{" "}
                <span className="text-gray-500 text-xs block sm:inline sm:ml-2">thedailywire.com</span>
              </li>
              <li>
                Elon Musk teases new Tesla product{" "}
                <span className="text-gray-500 text-xs block sm:inline sm:ml-2">thedailywire.com</span>
              </li>
            </ul>
          </div>
        </motion.div>
      </Link>

      <Link
        href="/summary"
        className="block col-span-1 min-h-56 border border-blue-500 rounded-xl shadow-md p-6 
                  bg-linear-to-br from-[#0e111a] to-[#1a1f2a] text-white hover:shadow-lg 
                  transition-shadow cursor-pointer">
        <motion.div variants={cardVariants}>
          <div>
            <h2 className="text-2xl font-bold mb-4 text-blue-500">Market Summary</h2>
            <ul className="space-y-4 text-xl">
              <li>
                S&amp;P 500: 4250 <span className="text-xs text-red-500">(-6.7%)</span>
              </li>
              <li>
                DOW 10000 <span className="text-xs text-red-500">(-6.7%)</span>
              </li>
              <li>
                NASDAQ 6969 <span className="text-xs text-red-500">(-6.7%)</span>
              </li>
            </ul>
          </div>
        </motion.div>
      </Link>

      <Link 
      href="/stocks/losers"
      className="sm:col-span-2 border border-blue-500 rounded-xl shadow-md p-6 bg-linear-to-br from-[#0e111a] to-[#1a1f2a] text-white hover:shadow-lg transition-shadow">
      <motion.div
        variants={cardVariants}
      >
        <h2 className="text-2xl font-bold mb-4 text-blue-500">Top Losers Today</h2>
        <ul className="space-y-4 text-xl">
          <li>
            NVIDIA (NVDA) $100.69 <span className="text-xs text-green-500">(+3.4%)</span>
          </li>
          <li>
            NVIDIA (NVDA) $100.69 <span className="text-xs text-green-500">(+3.4%)</span>
          </li>
          <li>
            NVIDIA (NVDA) $100.69 <span className="text-xs text-green-500">(+3.4%)</span>
          </li>
        </ul>
      </motion.div>
      </Link>

      <Link href="stocks/gainers" className="sm:col-span-2 min-h-56 border border-blue-500 rounded-xl shadow-md p-6 bg-linear-to-br from-[#0e111a] to-[#1a1f2a] text-white hover:shadow-lg transition-shadow"
>
      <motion.div
      variants={cardVariants}
      >
        <h2 className="text-2xl font-bold mb-4 text-blue-500">Top Gainers Today</h2>
        <ul className="space-y-4 text-xl">
          <li>
            NVIDIA (NVDA) $100.69 <span className="text-xs text-green-500">(+3.4%)</span>
          </li>
          <li>
            NVIDIA (NVDA) $100.69 <span className="text-xs text-green-500">(+3.4%)</span>
          </li>
          <li>
            NVIDIA (NVDA) $100.69 <span className="text-xs text-green-500">(+3.4%)</span>
          </li>
        </ul>
      </motion.div>
      </Link>
    </motion.main>
  );
}