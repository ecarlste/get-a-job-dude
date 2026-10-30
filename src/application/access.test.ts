import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from "vitest";
import type { Db } from "@/db/client";
import { owner, viewerMembership } from "@/db/schema";
import { seedPeople } from "@/db/seed";
import { createTestDatabase } from "@/test/database";
import { asPerson } from "@/test/people";
import { createApplication, type Application } from ".";
import { can, type Access } from "./access";

const now = new Date("2026-11-02T15:00:00Z");

const loopCompanies = (view: Awaited<ReturnType<Application["mainView"]>>) =>
  view.access === "none" ? [] : view.interviewLoops.map((l) => l.company);

describe("access", () => {
  let db: Db;
  let app: Application;

  const ownerIdOf = async (userId: string) =>
    (await db.select().from(owner).where(eq(owner.userId, userId)))[0].id;

  beforeEach(async () => {
    db = await createTestDatabase();
    app = createApplication({
      db,
      clock: { now: () => now },
      ownerEmail: seedPeople.owner.email,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
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

  it("refusing a permission doesn't narrow an Owner or Viewer to no access", () => {
    const access = { role: "viewer", ownerId: "o" } as Access;

    if (can(access, "readSearch")) expectTypeOf(access.role).toEqualTypeOf<"owner" | "viewer">();
    else expectTypeOf(access).toEqualTypeOf<Access>();
  });

  it("never shows one Owner's data to another Owner's people, listing loops by company", async () => {
    const rowansView = await app.mainView(asPerson(seedPeople.otherOwner));

    expect(loopCompanies(rowansView)).toEqual(["Lumen Ridge", "Quillfeather"]);
  });

  it("lets a person be a Viewer of at most one Owner", async () => {
    const insertSecond = db
      .insert(viewerMembership)
      .values({ ownerId: await ownerIdOf(seedPeople.otherOwner.id), userId: seedPeople.viewer.id });

    await expect(insertSecond).rejects.toThrow();
  });

  it("gives no access to a person who is both an Owner and a Viewer rather than picking one", async () => {
    await db
      .insert(viewerMembership)
      .values({ ownerId: await ownerIdOf(seedPeople.owner.id), userId: seedPeople.otherOwner.id });
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(await app.mainView(asPerson(seedPeople.otherOwner))).toEqual({ access: "none" });
    expect(logged).toHaveBeenCalledWith(expect.stringMatching(/both an Owner and a Viewer/));
  });
});
