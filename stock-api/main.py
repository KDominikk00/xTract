# stock-api/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi_utils.tasks import repeat_every
import httpx
import os
from dotenv import load_dotenv
import yfinance as yf

load_dotenv("../.env.local")
FMP_API_KEY = os.getenv("FMP_API_KEY")

app = FastAPI(title="Stock API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

cached_gainers: list = []
cached_losers: list = []
cached_news: list = []
cached_summary: list = []

def fetch_market_summary():
    global cached_summary
    if cached_summary:
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
            changePercent = change / latest["Open"] * 100
            summary.append({
                "symbol": idx["symbol"],
                "name": idx["name"],
                "price": round(latest["Close"], 2),
                "change": round(change, 2),
                "changePercent": round(changePercent, 2),
            })
    cached_summary = summary
    return summary

@app.on_event("startup")
@repeat_every(seconds=30 * 60, raise_exceptions=True)
async def fetch_stocks():
    global cached_gainers, cached_losers
    async with httpx.AsyncClient() as client:
        try:
            gainers_res = await client.get(
                f"https://financialmodelingprep.com/stable/biggest-gainers?apikey={FMP_API_KEY}"
            )
            if gainers_res.status_code == 200:
                cached_gainers = gainers_res.json()

            losers_res = await client.get(
                f"https://financialmodelingprep.com/stable/biggest-losers?apikey={FMP_API_KEY}"
            )
            if losers_res.status_code == 200:
                cached_losers = losers_res.json()

        except Exception as e:
            print("⚠️ Error fetching stocks:", e)

@app.on_event("startup")
@repeat_every(seconds=8 * 60 * 60, raise_exceptions=True)
async def fetch_news():
    global cached_news
    async with httpx.AsyncClient() as client:
        try:
            news_res = await client.get(
                f"https://financialmodelingprep.com/stable/fmp-articles?page=0&limit=20&apikey={FMP_API_KEY}"
            )
            if news_res.status_code == 200:
                cached_news = news_res.json()
        except Exception as e:
            print("⚠️ Error fetching news:", e)

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