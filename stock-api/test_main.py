import os

# Keep tests offline and deterministic: no FMP key, no startup refresh side effects.
os.environ.pop("FMP_API_KEY", None)

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

import main


@pytest.fixture(autouse=True)
def reset_state(monkeypatch):
    main.cached_quotes.clear()
    monkeypatch.setattr(main, "STOCK_API_SECRET", None)


@pytest.fixture
def client():
    # No `with`: skips the startup tasks that would call external services.
    return TestClient(main.app)


def test_validate_symbol():
    assert main.validate_symbol(" brk.b ") == "BRK.B"
    for bad in ["..", "A/B", "A" * 13, "", "AAPL;x"]:
        with pytest.raises(HTTPException) as exc:
            main.validate_symbol(bad)
        assert exc.value.status_code == 400


def test_quote_cache_is_bounded():
    for i in range(main.QUOTE_CACHE_MAX_ENTRIES + 50):
        main.store_quote(f"X{i}", {"price": i})
    assert len(main.cached_quotes) == main.QUOTE_CACHE_MAX_ENTRIES


def test_normalize_fmp_quote_unifies_schema():
    quote = main.normalize_fmp_quote(
        {"symbol": "AAPL", "name": "Apple", "price": 10.5, "changePercentage": 2.0, "volume": float("nan")},
        "AAPL",
    )
    assert quote["changesPercentage"] == 2.0
    assert quote["volume"] is None  # NaN must not leak into JSON
    assert quote["name"] == "Apple"


def test_history_rejects_unsupported_ranges_and_symbols(client):
    assert client.get("/stocks/history/AAPL?period=max&interval=1m").status_code == 400
    assert client.get("/stocks/history/..?period=1mo&interval=1d").status_code in (400, 404)


def test_list_bounds(client):
    assert client.get("/stocks/news?n=-1").status_code == 422
    assert client.get("/stocks/gainers?n=0").status_code == 422


def test_api_key_required_when_secret_is_set(client, monkeypatch):
    monkeypatch.setattr(main, "STOCK_API_SECRET", "s3cret")
    assert client.get("/health").status_code == 200  # Render health check stays open
    assert client.get("/stocks/news").status_code == 401
    assert client.get("/stocks/news", headers={"x-stock-api-key": "wrong"}).status_code == 401
    assert client.get("/stocks/news", headers={"x-stock-api-key": "s3cret"}).status_code == 200
