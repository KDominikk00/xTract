# main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi_utils.tasks import repeat_every
import httpx
import os
from dotenv import load_dotenv

load_dotenv("../.env.local")
FMP_API_KEY = os.getenv("FMP_API_KEY")

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

cached_gainers = []
cached_losers = []

@app.on_event("startup")
@repeat_every(seconds=15 * 60, raise_exceptions=True)
async def fetch_top_movers():
    """Fetch top gainers and losers from Financial Modeling Prep every 15 minutes."""
    global cached_gainers, cached_losers

    async with httpx.AsyncClient() as client:
        try:
            print("Fetching top movers from FMP...")

            gainers_res = await client.get(
                f"https://financialmodelingprep.com/stable/biggest-gainers?apikey={FMP_API_KEY}"
            )
            losers_res = await client.get(
                f"https://financialmodelingprep.com/stable/biggest-losers?apikey={FMP_API_KEY}"
            )

            if gainers_res.status_code == 200:
                cached_gainers = gainers_res.json()
                print(f"✅ Updated {len(cached_gainers)} gainers.")
            else:
                print("❌ Error fetching gainers:", gainers_res.text)

            if losers_res.status_code == 200:
                cached_losers = losers_res.json()
                print(f"✅ Updated {len(cached_losers)} losers.")
            else:
                print("❌ Error fetching losers:", losers_res.text)

        except Exception as e:
            print("⚠️ Error fetching top movers:", e)


@app.get("/stocks/gainers")
def get_gainers(n: int = None):
    if n:
        return cached_gainers[:n]
    return cached_gainers

@app.get("/stocks/losers")
def get_losers(n: int = None):
    if n:
        return cached_losers[:n]
    return cached_losers