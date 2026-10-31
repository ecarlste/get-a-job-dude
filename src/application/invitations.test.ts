import { beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/db/client";
import { seedPeople } from "@/db/seed";
import { createTestDatabase } from "@/test/database";
import { asPerson } from "@/test/people";
import { createApplication, type Application } from ".";

const avery = asPerson(seedPeople.owner);
const sam = asPerson(seedPeople.stranger);

// The token is the link's last path segment.
const tokenOf = (path: string) => path.split("/").at(-1)!;

describe("invitations", () => {
  let db: Db;
  let app: Application;
  let now: Date;

  beforeEach(async () => {
    db = await createTestDatabase();
    now = new Date("2026-11-02T15:00:00Z");
    app = createApplication({ db, clock: { now: () => now }, ownerEmail: seedPeople.owner.email });
  });

  async function invite(email: string) {
    const created = await app.createInvitation(avery, email);
    if (!created.ok) throw new Error(`Invitation refused: ${created.reason}`);
    return tokenOf(created.path);
  }

  it("makes the invited Google account a Viewer of the Owner's search when they accept", async () => {
    const token = await invite(seedPeople.stranger.email);

    expect(await app.acceptInvitation(sam, token)).toEqual({ ok: true });
    expect(await app.mainView(sam)).toMatchObject({ access: "viewer", interviewLoops: [{ company: "Brightwater" }] });
  });

  it("refuses a link that has already been used", async () => {
    const token = await invite(seedPeople.stranger.email);
    await app.acceptInvitation(sam, token);

    expect(await app.acceptInvitation(sam, token)).toEqual({ ok: false, reason: "used" });
  });

  it("accepts a link until 7 days have passed, then refuses it as expired", async () => {
    const token = await invite(seedPeople.stranger.email);

    now = new Date("2026-11-09T15:00:00Z");
    expect(await app.acceptInvitation(sam, token)).toEqual({ ok: false, reason: "expired" });
    expect(await app.mainView(sam)).toEqual({ access: "none" });

    now = new Date("2026-11-09T14:59:59Z");
    expect(await app.acceptInvitation(sam, token)).toEqual({ ok: true });
  });

  it("refuses a Google account whose email isn't the invited one, and leaves the link usable", async () => {
    const token = await invite("casey@example.com");

    expect(await app.acceptInvitation(sam, token)).toEqual({ ok: false, reason: "wrongEmail" });
    expect(await app.mainView(sam)).toEqual({ access: "none" });
    const casey = { ...sam, email: "casey@example.com" };
    expect(await app.acceptInvitation(casey, token)).toEqual({ ok: true });
  });

  it("refuses the invited email when Google hasn't verified it", async () => {
    const token = await invite(seedPeople.stranger.email);

    expect(await app.acceptInvitation({ ...sam, emailVerified: false }, token)).toEqual({
      ok: false,
      reason: "wrongEmail",
    });
  });

  it("matches the invited email case-insensitively", async () => {
    const token = await invite("  SAM@example.COM ");

    expect(await app.acceptInvitation({ ...sam, email: "Sam@Example.com" }, token)).toEqual({ ok: true });
  });

  it("refuses an unknown link", async () => {
    expect(await app.acceptInvitation(sam, "not-a-real-token")).toEqual({ ok: false, reason: "notFound" });
  });

  it("doesn't let an Owner accept an Invitation, since nobody is both", async () => {
    const token = await invite(seedPeople.otherOwner.email);
    const rowan = asPerson(seedPeople.otherOwner);

    expect(await app.acceptInvitation(rowan, token)).toEqual({ ok: false, reason: "isOwner" });
    expect(await app.mainView(rowan)).toMatchObject({ access: "owner" });
  });

  it("doesn't let one Owner's Viewer accept another Owner's Invitation", async () => {
    const rowansInvitation = await app.createInvitation(asPerson(seedPeople.otherOwner), seedPeople.viewer.email);
    if (!rowansInvitation.ok) throw new Error("Rowan's Invitation was refused");
    const jordan = asPerson(seedPeople.viewer);

    expect(await app.acceptInvitation(jordan, tokenOf(rowansInvitation.path))).toEqual({
      ok: false,
      reason: "isViewer",
    });
    expect(await app.mainView(jordan)).toMatchObject({ interviewLoops: [{ company: "Brightwater" }] });
  });

  it("lists the Owner's pending Invitations and current Viewers, not used or lapsed ones", async () => {
    await invite("casey@example.com");
    now = new Date("2026-11-03T09:00:00Z");
    await app.acceptInvitation(sam, await invite(seedPeople.stranger.email));
    await invite("drew@example.com");
    now = new Date("2026-11-10T08:00:00Z");

    expect(await app.viewersView(avery)).toEqual({
      access: "owner",
      pendingInvitations: [
        { id: expect.any(String), email: "drew@example.com", expiresAt: new Date("2026-11-10T09:00:00Z") },
      ],
      viewers: [
        { userId: seedPeople.viewer.id, name: "Jordan Example", email: "jordan@example.com" },
        { userId: seedPeople.stranger.id, name: "Sam Example", email: "sam@example.com" },
      ],
    });
  });

  it("refuses a cancelled link and stops listing it", async () => {
    const token = await invite(seedPeople.stranger.email);
    const [pending] = await pendingInvitations();

    expect(await app.cancelInvitation(avery, pending.id)).toEqual({ ok: true });
    expect(await app.acceptInvitation(sam, token)).toEqual({ ok: false, reason: "cancelled" });
    expect(await pendingInvitations()).toEqual([]);
  });

  it("cuts a revoked Viewer off on their next request", async () => {
    const jordan = asPerson(seedPeople.viewer);
    expect(await app.mainView(jordan)).toMatchObject({ access: "viewer" });

    expect(await app.revokeViewer(avery, seedPeople.viewer.id)).toEqual({ ok: true });
    expect(await app.mainView(jordan)).toEqual({ access: "none" });
    expect(await app.viewersView(avery)).toMatchObject({ viewers: [] });
  });

  it("doesn't let another Owner cancel the Owner's Invitations or revoke their Viewers", async () => {
    const token = await invite(seedPeople.stranger.email);
    const [pending] = await pendingInvitations();
    const rowan = asPerson(seedPeople.otherOwner);

    expect(await app.cancelInvitation(rowan, pending.id)).toEqual({ ok: false, reason: "notFound" });
    expect(await app.revokeViewer(rowan, seedPeople.viewer.id)).toEqual({ ok: false, reason: "notFound" });
    expect(await app.viewersView(rowan)).toMatchObject({ pendingInvitations: [], viewers: [] });
    expect(await app.acceptInvitation(sam, token)).toEqual({ ok: true });
    expect(await app.mainView(asPerson(seedPeople.viewer))).toMatchObject({ access: "viewer" });
  });

  it.each([
    ["a Viewer", seedPeople.viewer],
    ["a stranger", seedPeople.stranger],
  ])("doesn't let %s invite, list, cancel, or revoke", async (_, who) => {
    await invite("casey@example.com");
    const [pending] = await pendingInvitations();
    const person = asPerson(who);
    const noAccess = { ok: false, reason: "noAccess" };

    expect(await app.createInvitation(person, "drew@example.com")).toEqual(noAccess);
    expect(await app.viewersView(person)).toEqual({ access: "none" });
    expect(await app.cancelInvitation(person, pending.id)).toEqual(noAccess);
    expect(await app.revokeViewer(person, seedPeople.viewer.id)).toEqual(noAccess);
    expect(await pendingInvitations()).toHaveLength(1);
    expect(await app.mainView(asPerson(seedPeople.viewer))).toMatchObject({ access: "viewer" });
  });

  it("refuses an Invitation to something that isn't an email address", async () => {
    expect(await app.createInvitation(avery, "not an email")).toEqual({ ok: false, reason: "invalidEmail" });
  });

  describe("the Invitation page", () => {
    it("asks a signed-out person to sign in, naming the Owner, then offers the invited account the Invitation", async () => {
      const token = await invite(seedPeople.stranger.email);

      expect(await app.invitationView(null, token)).toEqual({ state: "signInRequired", ownerName: "Avery Example" });
      expect(await app.invitationView(sam, token)).toEqual({ state: "acceptable", ownerName: "Avery Example" });
    });

    it("says why a link can't be used, before sign-in when it can't be used by anyone", async () => {
      const usedToken = await invite(seedPeople.stranger.email);
      await app.acceptInvitation(sam, usedToken);
      const wrongEmailToken = await invite("casey@example.com");

      expect(await app.invitationView(null, usedToken)).toEqual({ state: "refused", reason: "used" });
      expect(await app.invitationView(null, "nope")).toEqual({ state: "refused", reason: "notFound" });
      expect(await app.invitationView(null, wrongEmailToken)).toMatchObject({ state: "signInRequired" });
      expect(await app.invitationView(sam, wrongEmailToken)).toEqual({ state: "refused", reason: "wrongEmail" });
      expect(await app.invitationView(avery, wrongEmailToken)).toEqual({ state: "refused", reason: "wrongEmail" });
    });
  });

  async function pendingInvitations() {
    const view = await app.viewersView(avery);
    if (view.access === "none") throw new Error("The Owner lost access");
    return view.pendingInvitations;
  }
});
