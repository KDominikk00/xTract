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
import { getHistory, Candle } from "@/lib/fetchStock";

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
      width: chartContainerRef.current.clientWidth,
      height: chartContainerRef.current.clientHeight,
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

    const handleResize = () => {
      if (!chartContainerRef.current || !chartRef.current) return;
      chartRef.current.applyOptions({
        width: chartContainerRef.current.clientWidth,
        height: chartContainerRef.current.clientHeight,
      });
      chartRef.current.timeScale().fitContent();
    };

    window.addEventListener("resize", handleResize);
    handleResize();

    return () => {
      chart.remove();
      window.removeEventListener("resize", handleResize);
    };
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
    <div className="w-full h-96 sm:mb-20">
      <div className="flex flex-row sm:justify-between sm:items-center mb-4 gap-2">

        <div className="hidden sm:flex gap-2">
          {intervalOptions.map((opt) => (
            <button
              key={opt.label}
              className={`px-3 py-1 cursor-pointer rounded ${
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

        <select
          className="sm:hidden w-16 px-3 py-2 rounded bg-gray-700 text-white"
          value={selectedIntervalLabel}
          onChange={(e) => {
            const selected = intervalOptions.find((opt) => opt.label === e.target.value);
            if (selected) {
              setInterval(selected.interval);
              setPeriod(selected.period);
              setSelectedIntervalLabel(selected.label);
            }
          }}
        >
          {intervalOptions.map((opt) => (
            <option key={opt.label} value={opt.label}>{opt.label}</option>
          ))}
        </select>

        <div className="hidden sm:flex relative w-48 h-10 bg-gray-700 rounded-full cursor-pointer select-none"
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
            <div className="w-1/2 flex items-center justify-center font-semibold text-white">
              Candle
            </div>
            <div className={`w-1/2 flex items-center justify-center font-semibold transition-colors duration-200 ${
              chartType === "line" ? "text-black" : "text-white"
            }`}>
              Line
            </div>
          </div>
        </div>

        <select
          className="sm:hidden px-3 py-2 rounded bg-gray-700 text-white"
          value={chartType}
          onChange={(e) => setChartType(e.target.value as "candlestick" | "line")}
        >
          <option value="candlestick">Candle</option>
          <option value="line">Line</option>
        </select>
      </div>

      <div
        ref={chartContainerRef}
        className="w-full h-64 sm:h-full rounded-xl border border-blue-500 shadow-md overflow-hidden"
      />
    </div>
  );
}