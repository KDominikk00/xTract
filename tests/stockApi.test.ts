import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchStockApi, readJson } from "@/lib/server/stockApi";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

describe("fetchStockApi", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubEnv("STOCK_API_BASE_URL", "http://stock.test");
    vi.stubEnv("STOCK_API_SECRET", "s3cret");
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("sends the shared secret header", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    await fetchStockApi("/stocks/news");

    expect(fetchMock.mock.calls[0][0]).toBe("http://stock.test/stocks/news");
    expect(fetchMock.mock.calls[0][1].headers).toEqual({ "X-Stock-Api-Key": "s3cret" });
  });

  it("retries while the upstream is waking, then succeeds", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("Too Many Requests", { status: 429 }))
      .mockRejectedValueOnce(new Error("timeout"))
      .mockResolvedValueOnce(json([1, 2]));
    vi.stubGlobal("fetch", fetchMock);

    const pending = fetchStockApi("/stocks/gainers");
    await vi.advanceTimersByTimeAsync(10_000);
    const res = await pending;

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(await readJson(res)).toEqual([1, 2]);
  });

  it("does not retry non-transient errors", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({ detail: "bad" }, 400));
    vi.stubGlobal("fetch", fetchMock);

    const res = await fetchStockApi("/stocks/history/AAPL");

    expect(res.status).toBe(400);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("gives up after the last retry and returns the final response", async () => {
    const fetchMock = vi.fn().mockImplementation(async () => new Response("Too Many Requests", { status: 429 }));
    vi.stubGlobal("fetch", fetchMock);

    const pending = fetchStockApi("/stocks/news");
    await vi.advanceTimersByTimeAsync(60_000);
    const res = await pending;

    expect(res.status).toBe(429);
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });
});

describe("readJson", () => {
  it("returns null for non-JSON bodies instead of throwing", async () => {
    expect(await readJson(new Response("Too Many Requests", { status: 429 }))).toBeNull();
  });
});
