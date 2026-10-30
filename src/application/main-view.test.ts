import { afterEach, describe, expect, it, vi } from "vitest";
import { seedPeople } from "@/db/seed";
import { createTestDatabase } from "@/test/database";
import { asPerson } from "@/test/people";
import { createApplication } from ".";

const now = new Date("2026-11-02T15:00:00Z");

// One database per test, built for the Owner email that test configures.
const appWithOwnerEmail = async (ownerEmail: string) =>
  createApplication({ db: await createTestDatabase(), clock: { now: () => now }, ownerEmail });

// A seeded Google user who isn't an Owner yet, so first sign-in can make them one.
const appForSam = () => appWithOwnerEmail(seedPeople.stranger.email);

describe("main view", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("greets the configured Owner with an empty search after first sign-in", async () => {
    const app = await appForSam();
    const sam = asPerson(seedPeople.stranger);
    await app.recordSignIn(sam);

    expect(await app.mainView(sam)).toEqual({
      access: "owner",
      greetingName: "Sam Example",
      now,
      interviewLoops: [],
    });
  });

  it("matches the configured Owner email case-insensitively", async () => {
    const app = await appForSam();
    const sam = { ...asPerson(seedPeople.stranger), email: "Sam@Example.com" };
    await app.recordSignIn(sam);

    expect(await app.mainView(sam)).toMatchObject({ access: "owner" });
  });

  it("does not make anyone else the Owner", async () => {
    const app = await appWithOwnerEmail("someone-else@example.com");
    const sam = asPerson(seedPeople.stranger);
    await app.recordSignIn(sam);

    expect(await app.mainView(sam)).toEqual({ access: "none" });
  });

  it("does not make an unverified Google email the Owner", async () => {
    const app = await appForSam();
    const sam = { ...asPerson(seedPeople.stranger), emailVerified: false };
    await app.recordSignIn(sam);

    expect(await app.mainView(sam)).toEqual({ access: "none" });
  });

  it("does not make a Viewer an Owner, even when theirs is the configured Owner email", async () => {
    const app = await appWithOwnerEmail(seedPeople.viewer.email);
    const jordan = asPerson(seedPeople.viewer);
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    await app.recordSignIn(jordan);

    expect(await app.mainView(jordan)).toMatchObject({ access: "viewer" });
    expect(logged).toHaveBeenCalledWith(expect.stringMatching(/configured Owner email but is a Viewer/));
  });
});
