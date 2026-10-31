import type { Page } from "@playwright/test";
import { expect, signInAs, test } from "./test";
import { createPerson } from "./people";
import { seedPeople } from "../src/db/seed";

const { owner } = seedPeople;

// As the signed-in Owner: open Viewers, invite this email, and return the link shown.
async function invite(ownerPage: Page, email: string) {
  await ownerPage.getByRole("link", { name: "Viewers" }).click();
  await ownerPage.getByLabel("Viewer's email").fill(email);
  await ownerPage.getByRole("button", { name: "Create Invitation" }).click();
  const link = ownerPage.getByLabel(`Invitation link for ${email}`);
  await expect(link).toHaveValue(/\/invitations\//);
  return link.inputValue();
}

const listed = (page: Page, list: string, text: string) =>
  page.getByRole("list", { name: list }).getByRole("listitem").filter({ hasText: text });

const loops = (page: Page) => page.getByRole("list", { name: "Interview Loops" }).getByRole("listitem");

test("the Owner invites a Viewer, who signs in with the invited account and accepts", async ({ page, newPage }) => {
  const casey = await createPerson("Casey");
  await signInAs(page, owner);
  const link = await invite(page, casey.email);
  await expect(listed(page, "Pending Invitations", casey.email)).toBeVisible();

  const caseysPage = await newPage();
  await caseysPage.goto(link);
  await expect(caseysPage.getByRole("heading", { name: `${owner.name} invited you to view their search` })).toBeVisible();
  await expect(caseysPage.getByRole("button", { name: "Sign in with Google" })).toBeVisible();

  await signInAs(caseysPage, casey);
  await caseysPage.goto(link);
  await caseysPage.getByRole("button", { name: "Accept Invitation" }).click();
  await expect(caseysPage.getByRole("heading", { name: `Hi, ${casey.name}` })).toBeVisible();
  await expect(loops(caseysPage)).toHaveText([/Brightwater/]);

  await page.reload();
  await expect(listed(page, "Current Viewers", casey.email)).toBeVisible();
  await expect(listed(page, "Pending Invitations", casey.email)).toHaveCount(0);

  await caseysPage.goto(link);
  await expect(caseysPage.getByRole("heading", { name: "This Invitation has already been used" })).toBeVisible();
});

test("a Google account other than the invited one is refused and gets no access", async ({ page, newPage }) => {
  const drew = await createPerson("Drew");
  await signInAs(page, owner);
  const link = await invite(page, `someone-else-${drew.id}@example.com`);

  const drewsPage = await newPage();
  await signInAs(drewsPage, drew);
  await drewsPage.goto(link);
  await expect(drewsPage.getByRole("heading", { name: "This Invitation is for a different email" })).toBeVisible();
  await expect(drewsPage.getByRole("button", { name: "Accept Invitation" })).toHaveCount(0);

  await drewsPage.goto("/");
  await expect(drewsPage.getByRole("heading", { name: "No access" })).toBeVisible();
  await expect(drewsPage.getByText("Brightwater")).toHaveCount(0);
});

test("a Viewer revoked mid-session gets \"no access\" on their next request", async ({ page, newPage }) => {
  const emery = await createPerson("Emery");
  await signInAs(page, owner);
  const link = await invite(page, emery.email);
  const emerysPage = await newPage();
  await signInAs(emerysPage, emery);
  await emerysPage.goto(link);
  await emerysPage.getByRole("button", { name: "Accept Invitation" }).click();
  await expect(loops(emerysPage)).toHaveText([/Brightwater/]);

  await page.reload();
  await listed(page, "Current Viewers", emery.email).getByRole("button", { name: `Revoke ${emery.name}` }).click();
  await expect(listed(page, "Current Viewers", emery.email)).toHaveCount(0);

  await emerysPage.reload();
  await expect(emerysPage.getByRole("heading", { name: "No access" })).toBeVisible();
  await expect(emerysPage.getByText("Brightwater")).toHaveCount(0);
});
