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
      ownerEmail: seedPeople.owner.email,
    });
  });

  it("greets the configured Owner with an empty search after first sign-in", async () => {
    const avery = asPerson(seedPeople.owner);
    await app.recordSignIn(avery);

    expect(await app.mainView(avery)).toEqual({
      access: "owner",
      greetingName: "Avery Example",
      now,
      interviewLoops: [],
    });
  });

  it("matches the configured Owner email case-insensitively", async () => {
    const avery = { ...asPerson(seedPeople.owner), email: "Avery@Example.com" };
    await app.recordSignIn(avery);

    expect(await app.mainView(avery)).toMatchObject({ access: "owner" });
  });

  it("does not make an unverified Google email the Owner", async () => {
    const avery = { ...asPerson(seedPeople.owner), emailVerified: false };
    await app.recordSignIn(avery);

    expect(await app.mainView(avery)).toEqual({ access: "none" });
  });

  it("shows each Owner only their own Interview Loops", async () => {
    const rowan = asPerson(seedPeople.otherOwner);
    const avery = asPerson(seedPeople.owner);
    await app.recordSignIn(avery);

    const rowansView = await app.mainView(rowan);
    const rowansLoops = rowansView.access === "owner" ? rowansView.interviewLoops : [];
    expect(rowansLoops.map((l) => l.company).sort()).toEqual(["Lumen Ridge", "Quillfeather"]);
    expect(await app.mainView(avery)).toMatchObject({ interviewLoops: [] });
  });

  it("gives no access to a signed-in stranger", async () => {
    const sam = asPerson(seedPeople.stranger);
    await app.recordSignIn(sam);

    expect(await app.mainView(sam)).toEqual({ access: "none" });
  });
});
