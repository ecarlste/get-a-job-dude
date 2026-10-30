import { defineConfig, devices } from "@playwright/test";

// End-to-end tests: the production build against a throwaway Postgres
// (DATABASE_URL), reset and seeded with synthetic data by global setup.

const port = 3100;
const baseURL = `http://localhost:${port}`;

if (!process.env.DATABASE_URL) throw new Error("Set DATABASE_URL to a throwaway Postgres.");

export default defineConfig({
  testDir: "e2e",
  globalSetup: "./e2e/global-setup.ts",
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    timezoneId: "America/Chicago",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "phone", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: `npm run build && npm run start -- --port ${port}`,
    url: baseURL,
    timeout: 300_000,
    reuseExistingServer: !process.env.CI,
    env: {
      DATABASE_URL: process.env.DATABASE_URL,
      BETTER_AUTH_SECRET: "e2e-only-secret-not-used-anywhere-else",
      BETTER_AUTH_URL: baseURL,
      GOOGLE_CLIENT_ID: "e2e-unused",
      GOOGLE_CLIENT_SECRET: "e2e-unused",
      OWNER_EMAIL: "avery@example.com",
      E2E_TEST_MODE: "1",
      E2E_NOW: "2026-11-02T15:00:00Z",
    },
  },
});
