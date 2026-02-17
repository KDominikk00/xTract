"use client";

import { useAuth } from "@/lib/AuthProvider";
import { motion, easeOut } from "framer-motion";
import Link from "next/link";
import { FiCheck, FiX } from "react-icons/fi";

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
  const { user } = useAuth();
  const isFreeTier = true; // Placeholder

  return (
    <motion.main
      className="grid grid-cols-1 md:grid-cols-4 gap-2 bg-(--color-bg) min-h-2 sm:max-w-5xl m-4 my-20 sm:m-24 sm:mx-auto"
      initial="hidden"
      animate="show"
      variants={containerVariants}
      >
      <Link 
      href="/followed" 
      className="sm:col-span-4 min-h-56 border border-blue-500 rounded-xl shadow-md p-6 bg-linear-to-br from-[#0e111a] to-[#1a1f2a] text-white hover:shadow-lg transition-shadow">
      <motion.div
      variants={cardVariants}
      >
        <h2 className="text-2xl font-bold mb-4 text-blue-500">Followed Stocks</h2>
        <ul className="space-y-2">
          <li className="text-gray-500">
            Follow stocks to get live updates
          </li>
        </ul>
      </motion.div>
      </Link>

      <Link
        href="/news"
        className="block sm:col-span-3 min-h-56 border border-blue-500 rounded-xl shadow-md p-6 
                  bg-linear-to-br from-[#0e111a] to-[#1a1f2a] text-white hover:shadow-lg 
                  transition-shadow cursor-pointer">
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

      <Link href="stocks/gainers" className="sm:col-span-2 min-h-56 border border-blue-500 rounded-xl shadow-md p-6 bg-linear-to-br from-[#0e111a] to-[#1a1f2a] text-white hover:shadow-lg transition-shadow">
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

      <div className="sm:col-span-4 mt-16 px-4 md:px-0">
        <h2 className="text-3xl font-bold text-white text-center mb-12">
          Choose Your Plan
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          
          <div className="flex flex-col border border-blue-500 rounded-2xl p-10 bg-linear-to-br from-[#0e111a] to-[#1a1f2a] shadow-md hover:shadow-lg transition-shadow">
            <h3 className="text-xl font-bold text-blue-500 mb-2">Free</h3>
            <p className="text-white text-3xl font-bold mb-4">$0<span className="text-gray-400 text-sm">/forever</span></p>
            <ul className="space-y-2 text-white text-sm flex-1">
              <li><FiCheck className="inline text-green-500"/> Follow up to 3 stocks</li>
              <li><FiCheck className="inline text-green-500"/> AI buy/sell suggestions</li>
              <li><FiCheck className="inline text-green-500"/> Limited AI messages</li>
              <li><FiCheck className="inline text-green-500"/> Limited AI Insights</li>
              <li><FiX className="inline text-red-500"/> Custom email notifications</li>
              <li><FiX className="inline text-red-500"/> AI powered watchlist analysis</li>
              <li><FiX className="inline text-red-500"/> Mid-day &amp; closing market reports</li>
              <li><FiX className="inline text-red-500"/> AI trade sentinemt scanner</li>
              <li><FiX className="inline text-red-500"/> AI powered forecasts</li>
              <li><FiX className="inline text-red-500"/> Private beta features</li>
            </ul>
            {user && isFreeTier ? (
            <button
              className="w-full py-2 bg-gray-500 cursor-not-allowed rounded-lg font-semibold mt-6"
              disabled
            >
              Current Tier
            </button>
          ) : (
            <Link href="/signup" className="w-full">
              <button className="w-full py-2 bg-blue-500 hover:bg-blue-600 rounded-lg font-semibold mt-6 cursor-pointer">
                Get Started
              </button>
            </Link>
          )}
          </div>

          <div className="flex flex-col border border-blue-500 rounded-2xl p-10 bg-linear-to-br from-[#0e111a] to-[#1a1f2a] shadow-md hover:shadow-lg transition-shadow">
            <h3 className="text-xl font-bold text-blue-500 mb-2">Plus</h3>
            <p className="text-white text-3xl font-bold mb-4">$5<span className="text-gray-400 text-sm">/month</span></p>
            <ul className="space-y-2 text-white text-sm flex-1">
              <li><FiCheck className="inline text-green-500"/> Follow up to 3 stocks</li>
              <li><FiCheck className="inline text-green-500"/> AI buy/sell suggestions</li>
              <li><FiCheck className="inline text-green-500"/> More AI messages</li>
              <li><FiCheck className="inline text-green-500"/> More AI Insights</li>
              <li><FiCheck className="inline text-green-500"/> Custom email notifications</li>
              <li><FiCheck className="inline text-green-500"/> AI powered watchlist analysis</li>
              <li><FiCheck className="inline text-green-500"/> Mid-day &amp; closing market reports</li>
              <li><FiX className="inline text-red-500"/> AI trade sentinemt scanner</li>
              <li><FiX className="inline text-red-500"/> AI powered forecasts</li>
              <li><FiX className="inline text-red-500"/> Private beta features</li>
            </ul>
            <button className="w-full py-2 bg-blue-500 hover:bg-blue-600 rounded-lg font-semibold transition-colors mt-6 cursor-pointer">
              Upgrade
            </button>
          </div>

          <div className="relative flex flex-col border border-blue-500 rounded-2xl p-10 bg-linear-to-br from-[#0e111a] to-[#1a1f2a] shadow-md hover:shadow-lg transition-shadow">
            <div className="absolute -top-4 right-4 bg-blue-500 text-white text-xs font-bold px-3 py-1 rounded-full">
              BEST VALUE
            </div>
            <h3 className="text-xl font-bold text-blue-500 mb-2">Pro</h3>
            <p className="text-white text-3xl font-bold mb-4">$15<span className="text-gray-400 text-sm">/month</span></p>
            <ul className="space-y-2 text-white text-sm flex-1">
              <li><FiCheck className="inline text-green-500"/> Follow unlimited stocks</li>
              <li><FiCheck className="inline text-green-500"/> AI buy/sell suggestions</li>
              <li><FiCheck className="inline text-green-500"/> Unlimited AI messages</li>
              <li><FiCheck className="inline text-green-500"/> Unlimited AI Insights</li>
              <li><FiCheck className="inline text-green-500"/> Custom email notifications</li>
              <li><FiCheck className="inline text-green-500"/> AI powered watchlist analysis</li>
              <li><FiCheck className="inline text-green-500"/> Mid-day &amp; closing market reports</li>
              <li><FiCheck className="inline text-green-500"/> AI trade sentinemt scanner</li>
              <li><FiCheck className="inline text-green-500"/> AI powered forecasts</li>
              <li><FiCheck className="inline text-green-500"/> Private beta features</li>
            </ul>
            <button className="w-full py-2 bg-blue-500 hover:bg-blue-600 rounded-lg font-semibold transition-colors mt-6 cursor-pointer">
              Upgrade
            </button>
          </div>
        </div>
      </div>
    </motion.main>
  );
}