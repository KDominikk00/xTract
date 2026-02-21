"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/AuthProvider";
import { motion, easeOut } from "framer-motion";
import Link from "next/link";
import { FiCheck, FiX } from "react-icons/fi";
import { getGainers, getLosers, getNews, getSummary, Stock, NewsArticle, MarketSummary } from "@/lib/fetchStock";
import { getUserTier } from "@/lib/aiPlan";
import PlanActionButton from "@/components/PlanActionButton";
import { getAccessToken } from "@/lib/getAccessToken";

const containerVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.15 } },
};

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: easeOut } },
};

type FollowedPreviewStock = {
  symbol: string;
  name: string;
  currentPrice: number;
  changePercent: number;
};

export default function Home() {
  const { user } = useAuth();
  const userTier = getUserTier(user);

  const [topGainers, setTopGainers] = useState<Stock[]>([]);
  const [topLosers, setTopLosers] = useState<Stock[]>([]);
  const [topNews, setTopNews] = useState<NewsArticle[]>([]);
  const [marketSummary, setMarketSummary] = useState<MarketSummary[]>([]);
  const [followedPreview, setFollowedPreview] = useState<FollowedPreviewStock[]>([]);
  const [loadingFollowed, setLoadingFollowed] = useState(false);
  const [loadingStocks, setLoadingStocks] = useState(true);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [loadingNews, setLoadingNews] = useState(true);

  useEffect(() => {
    async function fetchStocks() {
      try {
        setLoadingStocks(true);
        const [gainers, losers] = await Promise.all([getGainers(5), getLosers(5)]);
        setTopGainers(gainers);
        setTopLosers(losers);
      } catch (err) {
        console.error("Failed to fetch stocks", err);
        setTopGainers([]);
        setTopLosers([]);
      } finally {
        setLoadingStocks(false);
      }
    }

    async function fetchNews() {
      try {
        setLoadingNews(true);
        const news = await getNews(3);
        setTopNews(news);
      } catch (err) {
        console.error("Failed to fetch news", err);
        setTopNews([]);
      } finally {
        setLoadingNews(false);
      }
    }

    async function fetchSummary() {
      try {
        setLoadingSummary(true);
        const summary = await getSummary();
        setMarketSummary(summary);
      } catch (err) {
        console.error("Failed to fetch market summary", err);
        setMarketSummary([]);
      } finally {
        setLoadingSummary(false);
      }
    }

    fetchStocks();
    fetchNews();
    fetchSummary();
  }, []);

  useEffect(() => {
    if (!user) {
      setFollowedPreview([]);
      return;
    }

    async function fetchFollowedPreview() {
      try {
        setLoadingFollowed(true);
        const token = await getAccessToken();
        if (!token) return;

        const followedRes = await fetch("/api/followed", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const followedData = (await followedRes.json()) as {
          followed?: Array<{ symbol: string }>;
        };

        if (!followedRes.ok || !Array.isArray(followedData.followed)) {
          setFollowedPreview([]);
          return;
        }

        const symbols = followedData.followed.slice(0, 5).map((item) => item.symbol);
        if (symbols.length === 0) {
          setFollowedPreview([]);
          return;
        }

        const quotesRes = await fetch("/api/stocks/quotes", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ symbols }),
        });
        const quotesData = (await quotesRes.json()) as {
          quotes?: FollowedPreviewStock[];
        };

        if (!quotesRes.ok || !Array.isArray(quotesData.quotes)) {
          setFollowedPreview([]);
          return;
        }

        setFollowedPreview(quotesData.quotes);
      } catch (err) {
        console.error("Failed to fetch followed preview:", err);
        setFollowedPreview([]);
      } finally {
        setLoadingFollowed(false);
      }
    }

    void fetchFollowedPreview();
  }, [user]);

  const renderStockList = (stocks: Stock[]) => (
    <ul className="space-y-3 text-sm sm:text-base lg:text-lg">
      {stocks.map((stock) => (
        <li key={stock.symbol} className="wrap-break-word">
          <strong>{stock.symbol}</strong> ({stock.name}) ${stock.price.toFixed(2)}{" "}
          <span className={`text-xs ${stock.changePercent >= 0 ? "text-green-500" : "text-red-500"}`}>
            {stock.changePercent >= 0 ? "+" : ""}
            {stock.changePercent.toFixed(2)}%
          </span>
        </li>
      ))}
    </ul>
  );

  const renderMarketSummary = (summary: MarketSummary[]) => (
    <ul className="space-y-3 text-sm sm:text-base lg:text-lg">
      {summary.map((idx) => (
        <li key={idx.symbol} className="wrap-break-word">
          <strong>{idx.name}</strong>: ${idx.price.toFixed(2)}{" "}
          <span className={idx.change >= 0 ? "text-green-500 text-xs" : "text-red-500 text-xs"}>
            ({idx.change >= 0 ? "+" : ""}{idx.changePercent.toFixed(2)}%)
          </span>
        </li>
      ))}
    </ul>
  );

  return (
    <motion.section
      className="mx-auto my-8 grid max-w-6xl grid-cols-1 gap-2 bg-(--color-bg) px-4 pb-8 sm:my-12 sm:px-6 md:grid-cols-4"
      initial="hidden"
      animate="show"
      variants={containerVariants}
    >
      <Link href="/followed" className="min-h-40 rounded-xl border border-blue-500 bg-linear-to-br from-[#0e111a] to-[#1a1f2a] p-5 text-white shadow-md transition-shadow hover:shadow-lg sm:min-h-48 sm:p-6 md:col-span-4">
        <motion.div variants={cardVariants}>
          <h2 className="mb-3 text-xl font-bold text-blue-500 sm:text-2xl">Followed Stocks</h2>
          {!user ? (
            <p className="text-gray-500">Log in and follow stocks to build your watchlist.</p>
          ) : loadingFollowed ? (
            <p className="text-gray-400">Loading followed stocks...</p>
          ) : followedPreview.length === 0 ? (
            <p className="text-gray-500">Follow stocks from a stock page using the star icon.</p>
          ) : (
            <ul className="space-y-2 text-sm sm:text-base">
              {followedPreview.map((stock) => (
                <li key={stock.symbol} className="wrap-break-word">
                  <strong>{stock.symbol}</strong> ({stock.name}) ${stock.currentPrice.toFixed(2)}{" "}
                  <span className={stock.changePercent >= 0 ? "text-green-400" : "text-red-400"}>
                    {stock.changePercent >= 0 ? "+" : ""}
                    {stock.changePercent.toFixed(2)}%
                  </span>
                </li>
              ))}
            </ul>
          )}
        </motion.div>
      </Link>

      <Link href="/news" className="block min-h-52 cursor-pointer rounded-xl border border-blue-500 bg-linear-to-br from-[#0e111a] to-[#1a1f2a] p-5 text-white shadow-md transition-shadow hover:shadow-lg sm:min-h-56 sm:p-6 md:col-span-3">
        <motion.div variants={cardVariants}>
          <h2 className="mb-4 text-xl font-bold text-blue-500 sm:text-2xl">Trending News</h2>
          {loadingNews ? (
            <p className="text-gray-400">Loading...</p>
          ) : topNews.length === 0 ? (
            <p className="text-gray-400">No news available</p>
          ) : (
            <ul className="space-y-3 text-base sm:text-lg">
              {topNews.map((news, idx) => (
                <li key={news.link + idx}>
                    <strong>{news.title}</strong>{" "}
                  <span className="text-gray-500 text-xs block sm:inline sm:ml-2">{news.site}</span>
                </li>
              ))}
            </ul>
          )}
        </motion.div>
      </Link>

      <Link href="/summary" className="col-span-1 block min-h-52 cursor-pointer rounded-xl border border-blue-500 bg-linear-to-br from-[#0e111a] to-[#1a1f2a] p-5 text-white shadow-md transition-shadow hover:shadow-lg sm:min-h-56 sm:p-6">
        <motion.div variants={cardVariants}>
          <h2 className="mb-4 text-xl font-bold text-blue-500 sm:text-2xl">Market Summary</h2>
          {loadingSummary ? (
            <p className="text-gray-400">Loading...</p>
          ) : marketSummary.length === 0 ? (
            <p className="text-gray-400">No data</p>
          ) : renderMarketSummary(marketSummary)}
        </motion.div>
      </Link>

      <Link href="/stocks/losers" className="col-span-1 block min-h-52 rounded-xl border border-blue-500 bg-linear-to-br from-[#0e111a] to-[#1a1f2a] p-5 text-white shadow-md transition-shadow hover:shadow-lg sm:min-h-56 sm:p-6 md:col-span-2">
        <motion.div variants={cardVariants}>
          <h2 className="mb-4 text-xl font-bold text-blue-500 sm:text-2xl">Top Losers Today</h2>
          {loadingStocks ? <p>Loading...</p> : renderStockList(topLosers)}
        </motion.div>
      </Link>

      <Link href="/stocks/gainers" className="col-span-1 block min-h-52 rounded-xl border border-blue-500 bg-linear-to-br from-[#0e111a] to-[#1a1f2a] p-5 text-white shadow-md transition-shadow hover:shadow-lg sm:min-h-56 sm:p-6 md:col-span-2">
        <motion.div variants={cardVariants}>
          <h2 className="mb-4 text-xl font-bold text-blue-500 sm:text-2xl">Top Gainers Today</h2>
          {loadingStocks ? <p>Loading...</p> : renderStockList(topGainers)}
        </motion.div>
      </Link>

      <div className="mt-8 px-0 sm:mt-12 md:col-span-4">
        <h2 className="mb-8 text-center text-2xl font-bold text-white sm:mb-10 sm:text-3xl">
          Choose Your Plan
        </h2>
        <div className="grid grid-cols-1 gap-5 sm:gap-6 lg:grid-cols-3">
          
          <div className="flex flex-col rounded-2xl border border-blue-500 bg-linear-to-br from-[#0e111a] to-[#1a1f2a] p-6 shadow-md transition-shadow hover:shadow-lg sm:p-8">
            <h3 className="text-xl font-bold text-blue-500 mb-2">Free</h3>
            <p className="text-white text-3xl font-bold mb-4">$0<span className="text-gray-400 text-sm">/forever</span></p>
            <ul className="space-y-2 text-white text-sm flex-1">
              <li><FiCheck className="inline text-green-500"/> Follow up to 3 stocks</li>
              <li><FiCheck className="inline text-green-500"/> 3 AI buy/sell suggestions per day</li>
              <li><FiCheck className="inline text-green-500"/> 3 AI chat questions per day</li>
              <li><FiCheck className="inline text-green-500"/> Limited AI Insights</li>
              <li><FiX className="inline text-red-500"/> Custom email notifications</li>
              <li><FiX className="inline text-red-500"/> AI powered watchlist analysis</li>
              <li><FiX className="inline text-red-500"/> Mid-day &amp; closing market reports</li>
              <li><FiX className="inline text-red-500"/> AI trade sentinemt scanner</li>
              <li><FiX className="inline text-red-500"/> AI powered forecasts</li>
              <li><FiX className="inline text-red-500"/> Private beta features</li>
            </ul>
            <PlanActionButton plan="free" currentTier={userTier} user={user} />
          </div>

          <div className="flex flex-col rounded-2xl border border-blue-500 bg-linear-to-br from-[#0e111a] to-[#1a1f2a] p-6 shadow-md transition-shadow hover:shadow-lg sm:p-8">
            <h3 className="text-xl font-bold text-blue-500 mb-2">Plus</h3>
            <p className="text-white text-3xl font-bold mb-4">$5<span className="text-gray-400 text-sm">/month</span></p>
            <ul className="space-y-2 text-white text-sm flex-1">
              <li><FiCheck className="inline text-green-500"/> Follow up to 3 stocks</li>
              <li><FiCheck className="inline text-green-500"/> 300 AI buy/sell suggestions / month</li>
              <li><FiCheck className="inline text-green-500"/> 1,000 AI chat questions / month</li>
              <li><FiCheck className="inline text-green-500"/> More AI Insights</li>
              <li><FiCheck className="inline text-green-500"/> Custom email notifications</li>
              <li><FiCheck className="inline text-green-500"/> AI powered watchlist analysis</li>
              <li><FiCheck className="inline text-green-500"/> Mid-day &amp; closing market reports</li>
              <li><FiX className="inline text-red-500"/> AI trade sentinemt scanner</li>
              <li><FiX className="inline text-red-500"/> AI powered forecasts</li>
              <li><FiX className="inline text-red-500"/> Private beta features</li>
            </ul>
            <PlanActionButton plan="plus" currentTier={userTier} user={user} />
          </div>

          <div className="relative flex flex-col rounded-2xl border border-blue-500 bg-linear-to-br from-[#0e111a] to-[#1a1f2a] p-6 shadow-md transition-shadow hover:shadow-lg sm:p-8">
            <div className="absolute -top-4 right-4 bg-blue-500 text-white text-xs font-bold px-3 py-1 rounded-full">
              BEST VALUE
            </div>
            <h3 className="text-xl font-bold text-blue-500 mb-2">Pro</h3>
            <p className="text-white text-3xl font-bold mb-4">$15<span className="text-gray-400 text-sm">/month</span></p>
            <ul className="space-y-2 text-white text-sm flex-1">
              <li><FiCheck className="inline text-green-500"/> Follow unlimited stocks</li>
              <li><FiCheck className="inline text-green-500"/> Unlimited AI buy/sell suggestions</li>
              <li><FiCheck className="inline text-green-500"/> Unlimited AI chat questions</li>
              <li><FiCheck className="inline text-green-500"/> Unlimited AI Insights</li>
              <li><FiCheck className="inline text-green-500"/> Custom email notifications</li>
              <li><FiCheck className="inline text-green-500"/> AI powered watchlist analysis</li>
              <li><FiCheck className="inline text-green-500"/> Mid-day &amp; closing market reports</li>
              <li><FiCheck className="inline text-green-500"/> AI trade sentinemt scanner</li>
              <li><FiCheck className="inline text-green-500"/> AI powered forecasts</li>
              <li><FiCheck className="inline text-green-500"/> Private beta features</li>
            </ul>
            <PlanActionButton plan="pro" currentTier={userTier} user={user} />
          </div>
        </div>
      </div>
    </motion.section>
  );
}
