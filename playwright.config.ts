import { defineConfig, devices } from "@playwright/test";
import { seedPeople } from "./src/db/seed";

// End-to-end tests: the production build against a throwaway Postgres on
// localhost (E2E_DATABASE_URL), reset and seeded with synthetic data by global setup.
// Not validated here, so commands that never touch the database (show-report,
// --list) work without it: global setup refuses a non-local URL before wiping
// anything, and next.config.ts refuses to build or start the server against one.

const port = 3100;
// Loopback only, so nothing else on the network can reach the test-only sign-in.
const host = "127.0.0.1";
const baseURL = `http://${host}:${port}`;

const databaseUrl = process.env.E2E_DATABASE_URL ?? "";

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
    command: `npm run build && npm run start -- --hostname ${host} --port ${port}`,
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
      OWNER_EMAIL: seedPeople.owner.email,
      E2E_TEST_MODE: "1",
      E2E_NOW: "2026-11-02T15:00:00Z",
      // A .env.local from `vercel env pull` may carry VERCEL, which would trip the
      // deployment refusal. Next never lets a .env file override a variable already
      // set, even an empty one, so this keeps it out of the local server.
      VERCEL: "",
    },
  },
});
