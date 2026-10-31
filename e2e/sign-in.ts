import { expect, type Page } from "@playwright/test";

// The test-only sign-in sets the session cookie on the page's context; then open the main view.
export async function signInAs(page: Page, { email }: { email: string }) {
  const response = await page.request.post("/api/auth/test/sign-in", { data: { email }, maxRedirects: 0 });
  expect(response.status()).toBe(302);
  await page.goto("/");
}
