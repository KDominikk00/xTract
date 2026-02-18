import { NextRequest, NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";

function parseUnixDate(timestamp?: number): string | null {
  if (!timestamp) return null;
  const d = new Date(timestamp * 1000);
  if (isNaN(d.getTime()) || d.getFullYear() > 3000) return null;
  return d.toLocaleDateString();
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ symbol: string }> }
) {
  const { symbol } = await params;

  try {
    const yf = new YahooFinance();
    const quote = await yf.quote(symbol.toUpperCase());

    const stockData = {
      name: quote.shortName || quote.longName || symbol.toUpperCase(),
      symbol: quote.symbol || symbol.toUpperCase(),

      currentPrice: quote.regularMarketPrice ?? 0,
      open: quote.regularMarketOpen ?? 0,
      close: quote.regularMarketPreviousClose ?? 0,
      high: quote.regularMarketDayHigh ?? 0,
      low: quote.regularMarketDayLow ?? 0,
      volume: quote.regularMarketVolume ?? 0,
      change: quote.regularMarketChange ?? 0,
      changePercent: quote.regularMarketChangePercent ?? 0,

      marketCap: quote.marketCap ?? null,
      fiftyTwoWeekHigh: quote.fiftyTwoWeekHigh ?? null,
      fiftyTwoWeekLow: quote.fiftyTwoWeekLow ?? null,
      trailingPE: quote.trailingPE ?? null,
      forwardPE: quote.forwardPE ?? null,
      priceToBook: quote.priceToBook ?? null,
      pegRatio: quote.pegRatio ?? null,
      dividendYield: quote.dividendYield ?? null,
      beta: quote.beta ?? null,
      earningsTimestamp: quote.earningsTimestamp ?? null,
      earningsDate: parseUnixDate(quote.earningsTimestamp),
      exDividendDate: parseUnixDate(quote.exDividendDate),
      dividendDate: parseUnixDate(quote.dividendDate),
      earningsQuarterlyGrowth: quote.earningsQuarterlyGrowth ?? null,
      revenuePerShare: quote.revenuePerShare ?? null,
      profitMargins: quote.profitMargins ?? null,
      operatingMargins: quote.operatingMargins ?? null,
      returnOnAssets: quote.returnOnAssets ?? null,
      returnOnEquity: quote.returnOnEquity ?? null,
      debtToEquity: quote.debtToEquity ?? null,

      sector: quote.sector ?? null,
      industry: quote.industry ?? null,
      fullTimeEmployees: quote.fullTimeEmployees ?? null,
      description: quote.longBusinessSummary ?? null,
      website: quote.website ?? null,
      headquarters: quote.city && quote.state ? `${quote.city}, ${quote.state}` : null,
    };

    return NextResponse.json(stockData);
  } catch (err) {
    console.error("Yahoo Finance error:", err);
    return NextResponse.json(
      { error: "Failed to fetch stock" },
      { status: 500 }
    );
  }
}