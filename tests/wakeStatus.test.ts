import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getWakeStatusSnapshot, subscribeWakeStatus, trackSlowRequest } from "@/lib/wakeStatus";

describe("trackSlowRequest", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("stays quiet for fast requests", async () => {
    const listener = vi.fn();
    const unsubscribe = subscribeWakeStatus(listener);

    const pending = trackSlowRequest(() => new Promise((resolve) => setTimeout(() => resolve("ok"), 1_000)));
    await vi.advanceTimersByTimeAsync(1_000);

    expect(await pending).toBe("ok");
    expect(getWakeStatusSnapshot()).toBe(false);
    expect(listener).not.toHaveBeenCalled();
    unsubscribe();
  });

  it("flags slow requests until they settle, even when they fail", async () => {
    const pending = trackSlowRequest(
      () => new Promise((_, reject) => setTimeout(() => reject(new Error("boom")), 20_000))
    );
    const assertion = expect(pending).rejects.toThrow("boom");

    await vi.advanceTimersByTimeAsync(5_000);
    expect(getWakeStatusSnapshot()).toBe(true);

    await vi.advanceTimersByTimeAsync(15_000);
    await assertion;
    expect(getWakeStatusSnapshot()).toBe(false);
  });

  it("stays flagged while any slow request is still pending", async () => {
    const first = trackSlowRequest(() => new Promise((resolve) => setTimeout(resolve, 10_000)));
    const second = trackSlowRequest(() => new Promise((resolve) => setTimeout(resolve, 30_000)));

    await vi.advanceTimersByTimeAsync(10_000);
    await first;
    expect(getWakeStatusSnapshot()).toBe(true);

    await vi.advanceTimersByTimeAsync(20_000);
    await second;
    expect(getWakeStatusSnapshot()).toBe(false);
  });
});
