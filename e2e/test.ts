import { test as base, expect, type BrowserContext, type Page } from "@playwright/test";

export { expect } from "@playwright/test";

// The instant both the server (E2E_NOW) and every browser page see as now.
export const fixedNow = "2026-11-02T15:00:00Z";

// Use this `test` in every spec, so the browser clock matches the server's fixed clock.
// `newPage` opens another person's page (its own cookies), for tests with two people at once.
export const test = base.extend<{ newPage: () => Promise<Page> }>({
  page: async ({ page }, use) => {
    await page.clock.setFixedTime(fixedNow);
    await use(page);
  },
  newPage: async ({ browser }, use, testInfo) => {
    const contexts: BrowserContext[] = [];
    await use(async () => {
      // browser.newContext() doesn't get the project's options, so pass the ones we rely on.
      const { baseURL, viewport, userAgent, deviceScaleFactor, isMobile, hasTouch, timezoneId } =
        testInfo.project.use;
      const context = await browser.newContext({
        baseURL,
        viewport,
        userAgent,
        deviceScaleFactor,
        isMobile,
        hasTouch,
        timezoneId,
      });
      contexts.push(context);
      const page = await context.newPage();
      await page.clock.setFixedTime(fixedNow);
      return page;
    });
    await Promise.all(contexts.map((c) => c.close()));
  },
});

// The test-only sign-in sets the session cookie on the page's context; then open the main view.
export async function signInAs(page: Page, { email }: { email: string }) {
  const response = await page.request.post("/api/auth/test/sign-in", { data: { email }, maxRedirects: 0 });
  expect(response.status()).toBe(302);
  await page.goto("/");
}
