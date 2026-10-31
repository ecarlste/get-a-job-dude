import { beforeEach, describe, expect, it } from "vitest";
import { seedPeople } from "@/db/seed";
import { createTestDatabase } from "@/test/database";
import { asPerson } from "@/test/people";
import { createApplication, type Application } from ".";

const now = new Date("2026-11-02T15:00:00Z");
const avery = asPerson(seedPeople.owner);

const quillfeather = {
  company: "Quillfeather",
  role: "Senior Engineer",
  location: "Remote",
  jobLink: "https://example.com/jobs/quillfeather-senior",
  appliedOn: "2026-10-26",
  people: "Casey (recruiter)",
};

describe("Interview Loops", () => {
  let app: Application;

  const loopsSeenBy = async (person = avery) => {
    const view = await app.mainView(person);
    return view.access === "none" ? [] : view.interviewLoops;
  };

  beforeEach(async () => {
    app = createApplication({
      db: await createTestDatabase(),
      clock: { now: () => now },
      ownerEmail: seedPeople.owner.email,
    });
  });

  it("lets the Owner create a loop by hand, open and with no source Job Lead", async () => {
    const created = await app.createInterviewLoop(avery, quillfeather);

    expect(created).toEqual({ ok: true, id: expect.any(String) });
    expect(await loopsSeenBy()).toContainEqual({
      id: created.ok ? created.id : "",
      ...quillfeather,
      ending: "open",
      jobLeadId: null,
    });
  });

  it("needs a company and a role, and keeps the other facts optional", async () => {
    const blank = { company: " ", role: "", location: "", jobLink: "", appliedOn: "", people: "" };

    expect(await app.createInterviewLoop(avery, blank)).toEqual({
      ok: false,
      error: "invalid",
      fieldErrors: { company: "Company is required", role: "Role is required" },
    });
    expect(await app.createInterviewLoop(avery, { ...blank, company: "Lumen Ridge", role: "Staff Engineer" })).toMatchObject({ ok: true });
    expect(await loopsSeenBy()).toContainEqual(
      expect.objectContaining({ company: "Lumen Ridge", location: "", jobLink: "", appliedOn: null, people: "" }),
    );
  });

  it("lists open loops before ended ones", async () => {
    expect((await loopsSeenBy()).map((l) => [l.company, l.ending])).toEqual([
      ["Brightwater", "open"],
      ["Alder & Finch", "withdrawn"],
    ]);
  });

  it("lets the Owner edit a loop's facts", async () => {
    const created = await app.createInterviewLoop(avery, quillfeather);
    if (!created.ok) throw new Error("setup failed");

    const edited = await app.editInterviewLoop(avery, created.id, { ...quillfeather, role: "Staff Engineer", people: "" });

    expect(edited).toEqual({ ok: true });
    expect(await loopsSeenBy()).toContainEqual(
      expect.objectContaining({ id: created.id, role: "Staff Engineer", people: "", ending: "open" }),
    );
  });

  it("lets the Owner end a loop, which moves it below the open ones, and reopen it", async () => {
    const created = await app.createInterviewLoop(avery, quillfeather);
    if (!created.ok) throw new Error("setup failed");

    expect(await app.setLoopEnding(avery, created.id, "ghosted")).toEqual({ ok: true });
    expect((await loopsSeenBy()).map((l) => [l.company, l.ending])).toEqual([
      ["Brightwater", "open"],
      ["Alder & Finch", "withdrawn"],
      ["Quillfeather", "ghosted"],
    ]);

    expect(await app.setLoopEnding(avery, created.id, "open")).toEqual({ ok: true });
    expect((await loopsSeenBy()).map((l) => [l.company, l.ending])).toEqual([
      ["Brightwater", "open"],
      ["Quillfeather", "open"],
      ["Alder & Finch", "withdrawn"],
    ]);
  });

  it("lets the Owner delete a loop", async () => {
    const created = await app.createInterviewLoop(avery, quillfeather);
    if (!created.ok) throw new Error("setup failed");

    expect(await app.deleteInterviewLoop(avery, created.id)).toEqual({ ok: true });
    expect((await loopsSeenBy()).map((l) => l.company)).toEqual(["Brightwater", "Alder & Finch"]);
    expect(await app.deleteInterviewLoop(avery, created.id)).toEqual({ ok: false, error: "not-found" });
  });

  it("never lets one Owner change another Owner's loop", async () => {
    const rowan = asPerson(seedPeople.otherOwner);
    const [brightwater] = await loopsSeenBy();

    expect(await app.editInterviewLoop(rowan, brightwater.id, quillfeather)).toEqual({ ok: false, error: "not-found" });
    expect(await app.setLoopEnding(rowan, brightwater.id, "rejected")).toEqual({ ok: false, error: "not-found" });
    expect(await app.deleteInterviewLoop(rowan, brightwater.id)).toEqual({ ok: false, error: "not-found" });
    expect((await loopsSeenBy())[0]).toEqual(brightwater);
  });

  it("refuses every loop change from a signed-in stranger", async () => {
    const sam = asPerson(seedPeople.stranger);
    const [brightwater] = await loopsSeenBy();
    const forbidden = { ok: false, error: "forbidden" };

    expect(await app.createInterviewLoop(sam, quillfeather)).toEqual(forbidden);
    expect(await app.editInterviewLoop(sam, brightwater.id, quillfeather)).toEqual(forbidden);
    expect(await app.setLoopEnding(sam, brightwater.id, "rejected")).toEqual(forbidden);
    expect(await app.deleteInterviewLoop(sam, brightwater.id)).toEqual(forbidden);
    expect((await loopsSeenBy()).map((l) => l.company)).toEqual(["Brightwater", "Alder & Finch"]);
  });

  describe("as the Viewer", () => {
    const jordan = asPerson(seedPeople.viewer);

    it("shows the loop facts and offers no loop changes", async () => {
      expect(await app.mainView(jordan)).toMatchObject({ access: "viewer", canChangeLoops: false });
      expect(await app.mainView(avery)).toMatchObject({ access: "owner", canChangeLoops: true });
    });

    it("refuses to create a loop", async () => {
      expect(await app.createInterviewLoop(jordan, quillfeather)).toEqual({ ok: false, error: "forbidden" });
      expect((await loopsSeenBy()).map((l) => l.company)).not.toContain("Quillfeather");
    });

    it("refuses to edit, end, or delete a loop", async () => {
      const [brightwater] = await loopsSeenBy(jordan);
      const forbidden = { ok: false, error: "forbidden" };

      expect(await app.editInterviewLoop(jordan, brightwater.id, quillfeather)).toEqual(forbidden);
      expect(await app.setLoopEnding(jordan, brightwater.id, "rejected")).toEqual(forbidden);
      expect(await app.deleteInterviewLoop(jordan, brightwater.id)).toEqual(forbidden);
      expect((await loopsSeenBy())[0]).toEqual(brightwater);
    });
  });
});
