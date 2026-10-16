import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(root),
      // "server-only" throws outside Next's server bundle; tests import server modules directly.
      "server-only": path.resolve(root, "tests/server-only-stub.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    env: {
      STRIPE_SECRET_KEY: "sk_test_dummy",
      STRIPE_PRO_PRICE_ID: "price_pro",
      STRIPE_PLUS_PRICE_ID: "price_plus",
    },
  },
});
