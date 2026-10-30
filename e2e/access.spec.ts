import { expect, test, type Page } from "@playwright/test";

// The test-only sign-in sets the session cookie on the page's context; then open the main view.
async function signInAs(page: Page, email: string) {
  const response = await page.request.post("/api/auth/test/sign-in", { data: { email }, maxRedirects: 0 });
  expect(response.status()).toBe(302);
  await page.goto("/");
}

const loops = (page: Page) => page.getByRole("list", { name: "Interview Loops" }).getByRole("listitem");

test("the Owner signs in and sees their own Interview Loops only", async ({ page }) => {
  await signInAs(page, "avery@example.com");

  await expect(page.getByRole("heading", { name: "Hi, Avery Example" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
  await expect(loops(page)).toHaveText([/Brightwater/]);
});

test("the Owner's Viewer signs in and sees the Owner's Interview Loops only", async ({ page }) => {
  await signInAs(page, "jordan@example.com");

  await expect(page.getByRole("heading", { name: "Hi, Jordan Example" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "No access" })).toHaveCount(0);
  await expect(loops(page)).toHaveText([/Brightwater/]);
});

test("a signed-in stranger sees \"no access\" and no data", async ({ page }) => {
  await signInAs(page, "sam@example.com");

  await expect(page.getByRole("heading", { name: "No access" })).toBeVisible();
  await expect(page.getByText("This account doesn't have access.")).toBeVisible();
  await expect(loops(page)).toHaveCount(0);
  await expect(page.getByText("Brightwater")).toHaveCount(0);
  await expect(page.getByText("Quillfeather")).toHaveCount(0);
});
