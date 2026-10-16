import { describe, expect, it } from "vitest";
import { normalizeSymbol } from "@/lib/symbols";

describe("normalizeSymbol", () => {
  it("upper-cases and trims valid tickers", () => {
    expect(normalizeSymbol(" aapl ")).toBe("AAPL");
    expect(normalizeSymbol("brk.b")).toBe("BRK.B");
    expect(normalizeSymbol("BF-B")).toBe("BF-B");
  });

  it("rejects traversal, punctuation, length and non-strings", () => {
    for (const bad of ["..", ".A", "AAPL;x", "A/B", "A".repeat(13), "", "  ", 5, null, undefined]) {
      expect(normalizeSymbol(bad)).toBeNull();
    }
  });
});
