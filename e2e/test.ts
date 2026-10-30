import { test as base } from "@playwright/test";

export { expect } from "@playwright/test";

// The instant both the server (E2E_NOW) and every browser page see as now.
export const fixedNow = "2026-11-02T15:00:00Z";

// Use this `test` in every spec, so the browser clock matches the server's fixed clock.
export const test = base.extend({
  page: async ({ page }, use) => {
    await page.clock.setFixedTime(fixedNow);
    await use(page);
  },
});
