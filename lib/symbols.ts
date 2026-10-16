const SYMBOL_PATTERN = /^[A-Z][A-Z.\-]{0,11}$/;

// Returns the upper-cased ticker, or null when the input is not a plausible symbol.
export function normalizeSymbol(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const symbol = input.trim().toUpperCase();
  return SYMBOL_PATTERN.test(symbol) ? symbol : null;
}
