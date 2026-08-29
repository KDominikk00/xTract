from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi_utils.tasks import repeat_every
import httpx
import math
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
        return ["https://xtract.top", "http://localhost:3000"]
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
cached_quotes: dict[str, tuple[dict, datetime]] = {}
QUOTE_CACHE_TTL = timedelta(minutes=5)


@app.get("/")
def root():
    return {"service": "stock-api", "status": "ok"}


@app.get("/health")
def health():
    return {"status": "ok"}


def fetch_market_summary():
    global cached_summary, cached_summary_last_update

    # Summary data changes slowly relative to request volume, so we cache for one hour.
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

def refresh_stocks_once():
    global cached_gainers, cached_losers
    if not FMP_API_KEY:
        return

    try:
        with httpx.Client(timeout=15.0) as client:
            gainers_res = client.get(
                f"https://financialmodelingprep.com/stable/biggest-gainers?apikey={FMP_API_KEY}"
            )
            if gainers_res.status_code == 200:
                payload = gainers_res.json()
                if isinstance(payload, list):
                    cached_gainers = payload

            losers_res = client.get(
                f"https://financialmodelingprep.com/stable/biggest-losers?apikey={FMP_API_KEY}"
            )
            if losers_res.status_code == 200:
                payload = losers_res.json()
                if isinstance(payload, list):
                    cached_losers = payload
    except Exception as e:
        print("⚠️ Error refreshing stocks on demand:", e)


def refresh_news_once():
    global cached_news
    if not FMP_API_KEY:
        return

    try:
        with httpx.Client(timeout=15.0) as client:
            news_res = client.get(
                f"https://financialmodelingprep.com/stable/fmp-articles?page=0&limit=20&apikey={FMP_API_KEY}"
            )
            if news_res.status_code == 200:
                payload = news_res.json()
                if isinstance(payload, list):
                    cached_news = payload
    except Exception as e:
        print("⚠️ Error refreshing news on demand:", e)


def finite_number(value):
    try:
        number = float(value)
        return number if math.isfinite(number) else None
    except (TypeError, ValueError):
        return None


def get_cached_company_name(symbol: str) -> str:
    for stock in cached_gainers + cached_losers:
        if stock.get("symbol") == symbol and isinstance(stock.get("name"), str):
            return stock["name"]
    return symbol


def fetch_yahoo_quote(symbol: str) -> dict:
    ticker = yf.Ticker(symbol)
    try:
        fast_info = dict(ticker.fast_info)
    except Exception as error:
        print(f"Yahoo fast quote lookup failed for {symbol}: {type(error).__name__}")
        fast_info = {}

    try:
        history = ticker.history(period="5d", interval="1d", auto_adjust=False)
    except Exception as error:
        print(f"Yahoo history lookup failed for {symbol}: {type(error).__name__}")
        history = None

    completed_rows = []
    if history is not None and not history.empty:
        for _, row in history.iterrows():
            values = (row["Open"], row["High"], row["Low"], row["Close"])
            if all(finite_number(value) is not None for value in values):
                completed_rows.append(row)

    latest = completed_rows[-1] if completed_rows else None
    previous = completed_rows[-2] if len(completed_rows) > 1 else None

    def field(name: str, fallback=None):
        return finite_number(fast_info.get(name)) or fallback

    current_price = field("lastPrice", finite_number(latest["Close"]) if latest is not None else None)
    previous_close = field(
        "previousClose",
        finite_number(previous["Close"]) if previous is not None else current_price,
    )

    if current_price is None or previous_close is None:
        raise HTTPException(status_code=404, detail=f"No quote found for {symbol}")

    change = current_price - previous_close
    return {
        "name": get_cached_company_name(symbol),
        "symbol": symbol,
        "price": current_price,
        "open": field("open", finite_number(latest["Open"]) if latest is not None else current_price),
        "previousClose": previous_close,
        "dayHigh": field("dayHigh", finite_number(latest["High"]) if latest is not None else current_price),
        "dayLow": field("dayLow", finite_number(latest["Low"]) if latest is not None else current_price),
        "volume": field("lastVolume", finite_number(latest["Volume"]) if latest is not None else 0),
        "change": change,
        "changesPercentage": (change / previous_close) * 100 if previous_close else 0,
        "marketCap": field("marketCap"),
        "yearHigh": field("yearHigh"),
        "yearLow": field("yearLow"),
    }


def fetch_quote(symbol: str):
    normalized_symbol = symbol.strip().upper()
    cached = cached_quotes.get(normalized_symbol)
    if cached and datetime.utcnow() - cached[1] < QUOTE_CACHE_TTL:
        return cached[0]

    if FMP_API_KEY:
        try:
            with httpx.Client(timeout=15.0) as client:
                response = client.get(
                    "https://financialmodelingprep.com/stable/quote",
                    params={"symbol": normalized_symbol, "apikey": FMP_API_KEY},
                )
                response.raise_for_status()
                payload = response.json()
        except httpx.HTTPError as error:
            status_code = error.response.status_code if error.response is not None else "network"
            # Do not log the exception directly because its request URL includes the API key.
            print(f"FMP quote lookup failed for {normalized_symbol} (HTTP {status_code}); using Yahoo fallback.")
        else:
            if isinstance(payload, list) and payload and isinstance(payload[0], dict):
                quote = payload[0]
                cached_quotes[normalized_symbol] = (quote, datetime.utcnow())
                return quote

            print(f"FMP returned no quote for {normalized_symbol}; using Yahoo fallback.")

    quote = fetch_yahoo_quote(normalized_symbol)
    cached_quotes[normalized_symbol] = (quote, datetime.utcnow())
    return quote


@app.on_event("startup")
@repeat_every(seconds=30 * 60, raise_exceptions=True)
async def refresh_stocks():
    if not FMP_API_KEY:
        print("⚠️ FMP_API_KEY is missing. Skipping gainers/losers refresh.")
        return

    refresh_stocks_once()

@app.on_event("startup")
@repeat_every(seconds=8 * 60 * 60, raise_exceptions=True)  # 8 hours
async def refresh_news():
    if not FMP_API_KEY:
        print("⚠️ FMP_API_KEY is missing. Skipping news refresh.")
        return

    refresh_news_once()

@app.on_event("startup")
@repeat_every(seconds=60 * 60, raise_exceptions=True)
async def refresh_summary():
    fetch_market_summary()

@app.get("/stocks/gainers")
def get_gainers(n: int = None):
    # Lazy-refresh lets the API recover after cold starts without waiting for the next scheduler tick.
    if not cached_gainers:
        refresh_stocks_once()
    return cached_gainers[:n] if n else cached_gainers

@app.get("/stocks/losers")
def get_losers(n: int = None):
    if not cached_losers:
        refresh_stocks_once()
    return cached_losers[:n] if n else cached_losers

@app.get("/stocks/news")
def get_news(n: int = 20):
    if not cached_news:
        refresh_news_once()
    return cached_news[:n]

@app.get("/stocks/summary-data")
def get_summary():
    return fetch_market_summary()


@app.get("/stocks/quote/{symbol}")
def get_quote(symbol: str):
    return fetch_quote(symbol)

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

        candles = []
        for index, row in hist.iterrows():
            values = (row["Open"], row["High"], row["Low"], row["Close"])

            # Yahoo can include an unfinished daily row with NaN prices. JSON cannot
            # represent NaN, so omit it rather than failing the complete response.
            if not all(math.isfinite(float(value)) for value in values):
                continue

            candles.append(
                {
                    "time": int(index.timestamp()),
                    "open": round(float(row["Open"]), 2),
                    "high": round(float(row["High"]), 2),
                    "low": round(float(row["Low"]), 2),
                    "close": round(float(row["Close"]), 2),
                }
            )

        if not candles:
            raise HTTPException(status_code=404, detail=f"No completed historical data found for {symbol}")

        return candles
    except HTTPException:
        raise
    except Exception as e:
        print(f"⚠️ Error fetching history for {symbol}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch history for {symbol}")
