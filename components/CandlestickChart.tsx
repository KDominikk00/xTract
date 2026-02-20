"use client";

import { useRef, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  createChart,
  CandlestickSeries,
  LineSeries,
  ColorType,
} from "lightweight-charts";
import type { CandlestickData, UTCTimestamp, ISeriesApi } from "lightweight-charts";
import { getHistory } from "@/lib/fetchStock";

export default function CandlestickChart() {
  const params = useParams();
  const symbolParam = Array.isArray(params.symbol) ? params.symbol[0] : params.symbol;
  const stockSymbol = symbolParam?.toUpperCase() ?? "AAPL";

  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ReturnType<typeof createChart> | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const lineSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);

  const [interval, setInterval] = useState("1d");
  const [period, setPeriod] = useState("1mo");
  const [chartType, setChartType] = useState<"candlestick" | "line">("candlestick");
  const [selectedIntervalLabel, setSelectedIntervalLabel] = useState("1D");

  const intervalOptions = [
    { label: "1D", period: "1mo", interval: "1d" },
    { label: "1W", period: "3mo", interval: "1wk" },
    { label: "1M", period: "6mo", interval: "1wk" },
    { label: "YTD", period: "ytd", interval: "1d" },
    { label: "1Y", period: "1y", interval: "1wk" },
  ];

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: "#131722" },
        textColor: "#d1d4dc",
      },
      grid: {
        vertLines: { color: "#1f2943" },
        horzLines: { color: "#1f2943" },
      },
      crosshair: {
        mode: 0,
        vertLine: { color: "#758696", labelBackgroundColor: "#4c525e" },
        horzLine: { color: "#758696", labelBackgroundColor: "#4c525e" },
      },
      timeScale: { timeVisible: true, secondsVisible: false, rightOffset: 10 },
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#26a69a",
      downColor: "#ef5350",
      borderUpColor: "#26a69a",
      borderDownColor: "#ef5350",
      wickUpColor: "#26a69a",
      wickDownColor: "#ef5350",
    });

    const lineSeries = chart.addSeries(LineSeries, {
      color: "#4299e1",
      lineWidth: 2,
    });

    candleSeriesRef.current = candleSeries;
    lineSeriesRef.current = lineSeries;
    chartRef.current = chart;

    return () => chart.remove();
  }, []);

  useEffect(() => {
    async function fetchCandles() {
      if (!candleSeriesRef.current || !lineSeriesRef.current) return;

      try {
        const data: Candle[] = await getHistory(stockSymbol, period, interval);

        const formatted: CandlestickData[] = data.map((d) => ({
          time: d.time as UTCTimestamp,
          open: d.open,
          high: d.high,
          low: d.low,
          close: d.close,
        }));

        candleSeriesRef.current.setData(formatted);
        lineSeriesRef.current.setData(
          formatted.map((d) => ({ time: d.time, value: d.close }))
        );

        candleSeriesRef.current.applyOptions({ visible: chartType === "candlestick" });
        lineSeriesRef.current.applyOptions({ visible: chartType === "line" });

        chartRef.current?.timeScale().fitContent();
      } catch (err) {
        console.error("Error fetching historical data:", err);
      }
    }

    fetchCandles();
  }, [stockSymbol, interval, period, chartType]);

  return (
    <div className="w-full">
      <div className="flex justify-between mb-2 items-center">
        <div className="flex gap-2">
          {intervalOptions.map((opt) => (
            <button
              key={opt.label}
              className={`px-3 py-1 rounded ${
                selectedIntervalLabel === opt.label
                  ? "bg-blue-500 text-white"
                  : "bg-gray-700 text-gray-300"
              }`}
              onClick={() => {
                setInterval(opt.interval);
                setPeriod(opt.period);
                setSelectedIntervalLabel(opt.label);
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div
          className="relative w-48 h-10 bg-gray-700 rounded-full flex cursor-pointer select-none"
          onClick={() =>
            setChartType((prev) => (prev === "candlestick" ? "line" : "candlestick"))
          }
        >
          <div
            className={`absolute left-0 w-1/2 h-10 bg-blue-500 rounded-full transition-transform duration-200 ${
              chartType === "line" ? "translate-x-full" : "translate-x-0"
            }`}
          />

          <div className="flex w-full h-full z-10">
            <div
              className={`w-1/2 flex items-center justify-center font-semibold transition-colors duration-200 ${
                chartType === "candlestick" ? "text-black" : "text-white"
              }`}
            >
              Candle
            </div>

            <div
              className={`w-1/2 flex items-center justify-center font-semibold transition-colors duration-200 ${
                chartType === "line" ? "text-black" : "text-white"
              }`}
            >
              Line
            </div>
          </div>
        </div>
      </div>

      <div
        ref={chartContainerRef}
        className="relative w-full h-96 rounded-xl border border-blue-500 shadow-md overflow-hidden mb-10"
      />
    </div>
  );
}