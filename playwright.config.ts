import { defineConfig, devices } from "@playwright/test";
import { e2eDatabaseUrl } from "./e2e/database";

// End-to-end tests: the production build against a throwaway Postgres on
// localhost (E2E_DATABASE_URL), reset and seeded with synthetic data by global setup.

const port = 3100;
const baseURL = `http://localhost:${port}`;

const databaseUrl = e2eDatabaseUrl();

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
    // Always a fresh build with this env, never a server already on the port.
    reuseExistingServer: false,
    env: {
      DATABASE_URL: databaseUrl,
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
