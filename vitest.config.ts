import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // Each test starts, migrates, and seeds its own PGlite; a cold start on CI
    // already takes ~3s, too close to the 5s default.
    testTimeout: 20_000,
  },
});
