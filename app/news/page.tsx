"use client";

import { useEffect, useState } from "react";
import PageLayout from "@/components/PageLayout";

interface NewsArticle {
  title: string;
  content?: string;
  image: string;
  site: string;
  link: string;
  date: string;
}

export default function NewsPage() {
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchNews = async () => {
      try {
        const res = await fetch("http://localhost:8000/stocks/news");
        const data = await res.json();
        if (Array.isArray(data)) {
          setArticles(data);
        } else {
          console.warn("API returned invalid news data:", data);
          setArticles([]);
        }
      } catch (err) {
        console.error("Failed to load news:", err);
        setArticles([]);
      } finally {
        setLoading(false);
      }
    };
    fetchNews();
  }, []);

  return (
    <PageLayout className="max-w-6xl mx-auto px-6 py-16 text-white">
      <h1 className="text-4xl font-bold text-blue-500 mb-8 text-center md:text-left">
        Trending News
      </h1>

      {loading ? (
        <p className="text-center text-gray-400">Loading latest news…</p>
      ) : articles.length === 0 ? (
        <p className="text-center text-gray-400">No news available</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {articles.map((article) => (
            <a
              key={article.link}
              href={article.link}
              target="_blank"
              rel="noopener noreferrer"
              className="block bg-[#0e111a] rounded-xl overflow-hidden shadow-md hover:shadow-lg transition-shadow"
            >
              <img
                src={article.image || "https://via.placeholder.com/400x200"}
                alt={article.title}
                className="w-full h-48 object-cover"
              />
              <div className="p-5 space-y-2">
                <h2 className="text-xl font-bold text-blue-400">{article.title}</h2>
                <p className="text-gray-400 text-sm">
                  {article.site} •{" "}
                  {new Date(article.date).toLocaleDateString()}
                </p>
                <p className="text-gray-300 text-sm leading-relaxed line-clamp-3">
                  {(article.content || "").replace(/<[^>]+>/g, "")}
                </p>
              </div>
            </a>
          ))}
        </div>
      )}
    </PageLayout>
  );
}