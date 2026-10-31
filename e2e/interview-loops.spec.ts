import type { Page } from "@playwright/test";
import { expect, test } from "./test";
import { seedPeople } from "../src/db/seed";
import { signInAs } from "./sign-in";

const { viewer, otherOwner } = seedPeople;

// Changes are made as the second Owner, so the first Owner's seeded view that other
// specs assert on stays as seeded. Each project gets its own company name, since the
// desktop and phone runs share one database.

const loops = (page: Page) => page.getByRole("list", { name: "Interview Loops" }).getByRole("listitem");
const loop = (page: Page, company: string) => loops(page).filter({ hasText: company });

test("the Owner creates, edits, ends, reopens, and deletes a loop", async ({ page }, testInfo) => {
  const company = `Copperleaf ${testInfo.project.name}`;
  await signInAs(page, otherOwner);

  await page.getByRole("button", { name: "New loop" }).click();
  const form = page.getByRole("dialog", { name: "New Interview Loop" });
  await form.getByLabel("Company").fill(company);
  await form.getByLabel("Role").fill("Backend Engineer");
  await form.getByLabel("Location").fill("Remote");
  await form.getByLabel("Job link").fill("https://example.com/jobs/copperleaf");
  await form.getByLabel("Applied date").fill("2026-10-20");
  await form.getByLabel("People").fill("Morgan (recruiter)");
  await form.getByRole("button", { name: "Save" }).click();

  await expect(form).toBeHidden();
  await expect(loop(page, company)).toContainText("Backend Engineer");
  await expect(loop(page, company)).toContainText("Applied 2026-10-20");
  await expect(loop(page, company)).toContainText("Morgan (recruiter)");

  await page.getByRole("button", { name: `Edit ${company}` }).click();
  const edit = page.getByRole("dialog", { name: `Edit ${company}` });
  await expect(edit.getByLabel("Role")).toHaveValue("Backend Engineer");
  await edit.getByLabel("Role").fill("Staff Backend Engineer");
  await edit.getByRole("button", { name: "Save" }).click();
  await expect(edit).toBeHidden();
  await expect(loop(page, company)).toContainText("Staff Backend Engineer");

  await page.getByRole("combobox", { name: `Ending for ${company}` }).selectOption("rejected");
  await expect(loop(page, company)).toContainText("Ended: rejected");
  // Ended loops sit below the open ones.
  const companies = await loops(page).allTextContents();
  const endedAt = companies.findIndex((t) => t.includes(company));
  expect(endedAt).toBeGreaterThan(companies.findIndex((t) => t.includes("Quillfeather")));

  await page.getByRole("combobox", { name: `Ending for ${company}` }).selectOption("open");
  await expect(loop(page, company)).not.toContainText("Ended:");

  await page.getByRole("button", { name: `Delete ${company}` }).click();
  const confirm = page.getByRole("alertdialog", { name: `Delete ${company}?` });
  await confirm.getByRole("button", { name: "Cancel" }).click();
  await expect(confirm).toBeHidden();
  await expect(loop(page, company)).toHaveCount(1);

  await page.getByRole("button", { name: `Delete ${company}` }).click();
  await confirm.getByRole("button", { name: "Delete loop" }).click();
  await expect(loop(page, company)).toHaveCount(0);
});

test("the loop form shows required-field errors and saves nothing", async ({ page }) => {
  await signInAs(page, otherOwner);

  await page.getByRole("button", { name: "New loop" }).click();
  const form = page.getByRole("dialog", { name: "New Interview Loop" });
  await form.getByLabel("Location").fill("Nowhere Special");
  await form.getByRole("button", { name: "Save" }).click();

  await expect(form.getByText("Company is required")).toBeVisible();
  await expect(form.getByText("Role is required")).toBeVisible();
  await expect(form.getByLabel("Company")).toHaveAttribute("aria-invalid", "true");
  await form.getByRole("button", { name: "Cancel" }).click();
  await expect(form).toBeHidden();
  await expect(loop(page, "Nowhere Special")).toHaveCount(0);
});

test("the Viewer sees loops and their endings but no controls that change them", async ({ page }) => {
  await signInAs(page, viewer);

  await expect(loops(page)).toHaveText([/Brightwater/, /Alder & Finch.*Ended: withdrawn/]);
  await expect(page.getByRole("button", { name: "New loop" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^(Edit|Delete) / })).toHaveCount(0);
  await expect(page.getByRole("combobox", { name: /^Ending for / })).toHaveCount(0);
});
