import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // The first database test in each file migrates and seeds PGlite (~3.5s
    // cold), too close to the 5s default; the rest clone it in well under 1s.
    testTimeout: 10_000,
  },
});
