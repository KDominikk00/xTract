from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi_utils.tasks import repeat_every
import httpx
import os
from dotenv import load_dotenv
import yfinance as yf
from datetime import datetime, timedelta
from pathlib import Path

# Local development convenience only. Render will use real environment variables.
load_dotenv(Path(__file__).resolve().parents[1] / ".env.local")
FMP_API_KEY = os.getenv("FMP_API_KEY")

app = FastAPI(title="Stock API")

def parse_origins(value: str | None) -> list[str]:
    if not value:
        return ["http://localhost:3000"]
    return [origin.strip() for origin in value.split(",") if origin.strip()]


frontend_origins = parse_origins(os.getenv("FRONTEND_ORIGINS"))
frontend_origin_regex = os.getenv("FRONTEND_ORIGIN_REGEX")

app.add_middleware(
    CORSMiddleware,
    allow_origins=frontend_origins,
    allow_origin_regex=frontend_origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

cached_gainers: list = []
cached_losers: list = []
cached_news: list = []
cached_summary: list = []
cached_summary_last_update: datetime | None = None


@app.get("/")
def root():
    return {"service": "stock-api", "status": "ok"}


@app.get("/health")
def health():
    return {"status": "ok"}


def fetch_market_summary():
    global cached_summary, cached_summary_last_update

    if cached_summary and cached_summary_last_update and datetime.utcnow() - cached_summary_last_update < timedelta(hours=1):
        return cached_summary

    indices = [
        {"symbol": "^GSPC", "name": "S&P 500"},
        {"symbol": "^DJI", "name": "DOW"},
        {"symbol": "^IXIC", "name": "Nasdaq"},
    ]

    summary = []
    for idx in indices:
        ticker = yf.Ticker(idx["symbol"])
        hist = ticker.history(period="1d")
        if not hist.empty:
            latest = hist.iloc[-1]
            change = latest["Close"] - latest["Open"]
            change_percent = (change / latest["Open"]) * 100
            summary.append({
                "symbol": idx["symbol"],
                "name": idx["name"],
                "price": round(latest["Close"], 2),
                "change": round(change, 2),
                "changePercent": round(change_percent, 2),
            })

    cached_summary = summary
    cached_summary_last_update = datetime.utcnow()
    return summary

@app.on_event("startup")
@repeat_every(seconds=30 * 60, raise_exceptions=True)
async def refresh_stocks():
    global cached_gainers, cached_losers
    if not FMP_API_KEY:
        print("⚠️ FMP_API_KEY is missing. Skipping gainers/losers refresh.")
        return

    async with httpx.AsyncClient() as client:
        try:
            gainers_res = await client.get(f"https://financialmodelingprep.com/stable/biggest-gainers?apikey={FMP_API_KEY}")
            if gainers_res.status_code == 200:
                cached_gainers = gainers_res.json()

            losers_res = await client.get(f"https://financialmodelingprep.com/stable/biggest-losers?apikey={FMP_API_KEY}")
            if losers_res.status_code == 200:
                cached_losers = losers_res.json()

        except Exception as e:
            print("⚠️ Error fetching stocks:", e)

@app.on_event("startup")
@repeat_every(seconds=8 * 60 * 60, raise_exceptions=True)  # 8 hours
async def refresh_news():
    global cached_news
    if not FMP_API_KEY:
        print("⚠️ FMP_API_KEY is missing. Skipping news refresh.")
        return

    async with httpx.AsyncClient() as client:
        try:
            news_res = await client.get(
                f"https://financialmodelingprep.com/stable/fmp-articles?page=0&limit=20&apikey={FMP_API_KEY}"
            )
            if news_res.status_code == 200:
                cached_news = news_res.json()
        except Exception as e:
            print("⚠️ Error fetching news:", e)

@app.on_event("startup")
@repeat_every(seconds=60 * 60, raise_exceptions=True)
async def refresh_summary():
    fetch_market_summary()

@app.get("/stocks/gainers")
def get_gainers(n: int = None):
    return cached_gainers[:n] if n else cached_gainers

@app.get("/stocks/losers")
def get_losers(n: int = None):
    return cached_losers[:n] if n else cached_losers

@app.get("/stocks/news")
def get_news(n: int = 20):
    return cached_news[:n]

@app.get("/stocks/summary-data")
def get_summary():
    return fetch_market_summary()

@app.get("/stocks/history/{symbol}")
def get_stock_history(
    symbol: str,
    period: str = Query("1mo", description="yfinance period, e.g. 1mo, 3mo, 6mo, 1y, ytd"),
    interval: str = Query("1d", description="yfinance interval, e.g. 1d, 1h, 15m")
):
    try:
        yf_period = "ytd" if period.lower() == "ytd" else period
        ticker = yf.Ticker(symbol)
        hist = ticker.history(period=yf_period, interval=interval)

        if hist.empty:
            raise HTTPException(status_code=404, detail=f"No historical data found for {symbol}")

        return [
            {
                "time": int(index.timestamp()),
                "open": round(row["Open"], 2),
                "high": round(row["High"], 2),
                "low": round(row["Low"], 2),
                "close": round(row["Close"], 2),
            }
            for index, row in hist.iterrows()
        ]
    except HTTPException:
        raise
    except Exception as e:
        print(f"⚠️ Error fetching history for {symbol}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch history for {symbol}")
