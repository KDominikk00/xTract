"use client";

import React, { useEffect, useRef } from "react";
import PageLayout from "@/components/PageLayout";

export default function MarketPage() {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!container.current) return;

    container.current.innerHTML = "";

    const script = document.createElement("script");
    script.src =
      "https://s3.tradingview.com/external-embedding/embed-widget-stock-heatmap.js";
    script.type = "text/javascript";
    script.async = true;
    script.innerHTML = `
      {
        "dataSource": "SPX500",
        "blockSize": "market_cap_basic",
        "blockColor": "change",
        "grouping": "sector",
        "locale": "en",
        "colorTheme": "dark",
        "isZoomEnabled": true,
        "hasSymbolTooltip": true,
        "width": "100%",
        "height": "100%"
      }`;
    container.current.appendChild(script);
  }, []);

  return (
    <PageLayout className="max-w-5xl mx-auto px-6 py-16 text-white">
      <h1 className="text-4xl font-bold text-blue-500 mb-8 text-center md:text-left">
        Market Summary
      </h1>

      <div className="bg-[#0e111a] rounded-xl shadow-md p-4 h-[600px]">
        <div
          className="tradingview-widget-container w-full h-full"
          ref={container}
        >
          <div className="tradingview-widget-container__widget"></div>
        </div>
      </div>

      <p className="text-gray-400 text-sm mt-4 text-center">
        Live market heatmap powered by TradingView.
      </p>

      <section className="mt-12">
        <h2 className="text-2xl font-bold text-blue-500 mb-4">
          AI Market Insights
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-[#0e111a] rounded-xl shadow-md p-6">
            <h3 className="text-xl font-semibold text-blue-400 mb-2">
              Mid-Day Report
            </h3>
            <p className="text-gray-300 text-sm leading-relaxed">
              The market opened strong today with technology and energy sectors
              leading the gains. S&P 500 is up 1.2%, while Nasdaq shows a
              1.8% increase. Analysts note that investor sentiment is boosted
              by positive earnings reports from key tech companies.
            </p>
          </div>

          <div className="bg-[#0e111a] rounded-xl shadow-md p-6">
            <h3 className="text-xl font-semibold text-blue-400 mb-2">
              Closing Report
            </h3>
            <p className="text-gray-300 text-sm leading-relaxed">
              Markets closed mixed with S&P 500 up 0.5% and Nasdaq down 0.2%.
              Technology stocks cooled off after mid-day gains, while energy
              and industrials maintained strong performance. Overall trading
              volume was moderate, reflecting cautious investor sentiment ahead
              of tomorrow's economic reports.
            </p>
          </div>
        </div>
      </section>
    </PageLayout>
  );
}