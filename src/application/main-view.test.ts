import { beforeEach, describe, expect, it } from "vitest";
import { seedPeople } from "@/db/seed";
import { createTestDatabase } from "@/test/database";
import { createApplication, toPerson, type Application } from ".";

const now = new Date("2026-11-02T15:00:00Z");

const asPerson = (p: { id: string; name: string; email: string }) =>
  toPerson({ ...p, emailVerified: true });

describe("main view", () => {
  let app: Application;

  beforeEach(async () => {
    app = createApplication({
      db: await createTestDatabase(),
      clock: { now: () => now },
      // A seeded Google user who isn't an Owner yet, so first sign-in can make them one.
      ownerEmail: seedPeople.stranger.email,
    });
  });

  it("greets the configured Owner with an empty search after first sign-in", async () => {
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
    const sam = { ...asPerson(seedPeople.stranger), email: "Sam@Example.com" };
    await app.recordSignIn(sam);

    expect(await app.mainView(sam)).toMatchObject({ access: "owner" });
  });

  it("does not make an unverified Google email the Owner", async () => {
    const sam = { ...asPerson(seedPeople.stranger), emailVerified: false };
    await app.recordSignIn(sam);

    expect(await app.mainView(sam)).toEqual({ access: "none" });
  });

  it("does not make a Viewer an Owner, even when theirs is the configured Owner email", async () => {
    app = createApplication({
      db: await createTestDatabase(),
      clock: { now: () => now },
      ownerEmail: seedPeople.viewer.email,
    });
    const jordan = asPerson(seedPeople.viewer);
    await app.recordSignIn(jordan);

    expect(await app.mainView(jordan)).toMatchObject({ access: "viewer" });
  });
});
