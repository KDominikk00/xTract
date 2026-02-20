"use client";

import { useEffect, useRef, useState } from "react";
import { createChart, LineSeries, ColorType } from "lightweight-charts";
import type { UTCTimestamp, ISeriesApi } from "lightweight-charts";
import { getHistory, Candle } from "@/lib/fetchStock";

interface MiniChartProps {
  symbol: string;
  period?: string;
  interval?: string;
}

export default function MiniChart({ symbol, period = "1mo", interval = "1d" }: MiniChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const lineSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const chartRef = useRef<ReturnType<typeof createChart> | null>(null);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: "#131722" },
        textColor: "#d1d4dc",
      },
      grid: { vertLines: { visible: false }, horzLines: { visible: false } },
      crosshair: { mode: 0, vertLine: { visible: false }, horzLine: { visible: false } },
      rightPriceScale: { visible: false },
      timeScale: { visible: false },
    });

    const lineSeries = chart.addSeries(LineSeries, {
      color: "#4299e1",
      lineWidth: 2,
    });

    lineSeriesRef.current = lineSeries;
    chartRef.current = chart;

    return () => chart.remove();
  }, []);

  useEffect(() => {
    async function fetchCandles() {
      if (!lineSeriesRef.current) return;

      try {
        const data: Candle[] = await getHistory(symbol, period, interval);
        const formatted = data.map((d) => ({ time: d.time as UTCTimestamp, value: d.close }));
        lineSeriesRef.current.setData(formatted);
        chartRef.current?.timeScale().fitContent();
      } catch (err) {
        console.error(`Error fetching mini chart for ${symbol}:`, err);
      }
    }

    fetchCandles();
  }, [symbol, period, interval]);

  return (
    <div
      ref={chartContainerRef}
      className="w-full h-full rounded-md overflow-hidden"
    />
  );
}