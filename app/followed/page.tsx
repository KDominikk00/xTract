"use client";

import { fetchMarketData } from "@/lib/fetchStock";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import PageLayout from "@/components/PageLayout";
import { useAuth } from "@/lib/AuthProvider";
import { getAccessToken } from "@/lib/getAccessToken";

type FollowedSymbolRow = {
  symbol: string;
};

type FollowedStock = {
  symbol: string;
  name: string;
  currentPrice: number;
  changePercent: number;
};

export default function Followed() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stocks, setStocks] = useState<FollowedStock[]>([]);

  const loadFollowed = useCallback(async () => {
    if (!user) {
      setStocks([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const token = await getAccessToken();
      if (!token) {
        setStocks([]);
        return;
      }

      const followedRes = await fetch("/api/followed", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const followedData = (await followedRes.json()) as { followed?: FollowedSymbolRow[] };
      if (!followedRes.ok || !Array.isArray(followedData.followed)) {
        setStocks([]);
        return;
      }

      const symbols = followedData.followed.map((item) => item.symbol);
      if (symbols.length === 0) {
        setStocks([]);
        return;
      }

      const quotesRes = await fetchMarketData("/api/stocks/quotes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ symbols }),
      });
      const quotesData = (await quotesRes.json()) as { quotes?: FollowedStock[] };
      if (!quotesRes.ok || !Array.isArray(quotesData.quotes)) {
        setStocks([]);
        return;
      }

      setStocks(quotesData.quotes);
    } catch (err) {
      console.error("Failed to load followed stocks:", err);
      setStocks([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void loadFollowed();
  }, [loadFollowed]);

  async function unfollow(symbol: string) {
    try {
      const token = await getAccessToken();
      if (!token) return;

      const res = await fetch("/api/followed", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ symbol }),
      });
      if (!res.ok) return;
      setStocks((prev) => prev.filter((stock) => stock.symbol !== symbol));
    } catch (err) {
      console.error("Failed to unfollow stock:", err);
    }
  }

  return (
    <PageLayout className="mx-auto max-w-5xl px-4 py-10 text-white sm:px-6 sm:py-14">
      <h1 className="mb-4 text-3xl font-bold text-blue-500 sm:mb-6 sm:text-4xl">Followed Stocks</h1>

      {!user ? (
        <p className="max-w-xl text-sm text-gray-400 sm:text-base">
          Log in to save and view your followed stocks.
        </p>
      ) : loading ? (
        <p className="max-w-xl text-sm text-gray-400 sm:text-base">Loading your watchlist...</p>
      ) : stocks.length === 0 ? (
        <p className="max-w-xl text-sm text-gray-400 sm:text-base">
          Your watchlist is empty. Follow stocks using the star icon on each stock page.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {stocks.map((stock) => (
            <div
              key={stock.symbol}
              className="rounded-xl border border-blue-500 bg-[#0e111a] p-4 shadow-md"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <Link href={`/stocks/${stock.symbol}`} className="min-w-0">
                  <p className="break-words text-lg font-semibold text-white">{stock.name}</p>
                  <p className="text-sm text-gray-400">{stock.symbol}</p>
                  <p className="mt-2 text-sm text-white">${stock.currentPrice.toFixed(2)}</p>
                  <p className={stock.changePercent >= 0 ? "text-sm text-green-400" : "text-sm text-red-400"}>
                    {stock.changePercent >= 0 ? "+" : ""}
                    {stock.changePercent.toFixed(2)}%
                  </p>
                </Link>
                <button
                  onClick={() => unfollow(stock.symbol)}
                  className="self-start rounded bg-red-600 px-2 py-1 text-xs font-semibold text-white hover:bg-red-700 sm:self-auto"
                >
                  Unfollow
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </PageLayout>
  );
}
