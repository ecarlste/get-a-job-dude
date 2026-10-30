import { beforeEach, describe, expect, it } from "vitest";
import { seedPeople } from "@/db/seed";
import { createTestDatabase } from "@/test/database";
import { createApplication, toPerson, type Application } from ".";

const now = new Date("2026-11-02T15:00:00Z");

const asPerson = (p: { id: string; name: string; email: string }) =>
  toPerson({ ...p, emailVerified: true });

const loopCompanies = (view: Awaited<ReturnType<Application["mainView"]>>) =>
  view.access === "none" ? [] : view.interviewLoops.map((l) => l.company).sort();

describe("access", () => {
  let app: Application;

  beforeEach(async () => {
    app = createApplication({
      db: await createTestDatabase(),
      clock: { now: () => now },
      ownerEmail: seedPeople.owner.email,
    });
  });

  it("lets the Owner read their search", async () => {
    const view = await app.mainView(asPerson(seedPeople.owner));

    expect(view).toMatchObject({ access: "owner", greetingName: "Avery Example" });
    expect(loopCompanies(view)).toEqual(["Brightwater"]);
  });

  it("lets the Owner's Viewer read the Owner's search", async () => {
    const view = await app.mainView(asPerson(seedPeople.viewer));

    expect(view).toMatchObject({ access: "viewer", greetingName: "Jordan Example" });
    expect(loopCompanies(view)).toEqual(["Brightwater"]);
  });

  it("denies a signed-in stranger and shows no data", async () => {
    expect(await app.mainView(asPerson(seedPeople.stranger))).toEqual({ access: "none" });
  });

  it("never shows one Owner's data to another Owner's people", async () => {
    const rowansView = await app.mainView(asPerson(seedPeople.otherOwner));

    expect(loopCompanies(rowansView)).toEqual(["Lumen Ridge", "Quillfeather"]);
  });
});
