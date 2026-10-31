import { createHash, randomBytes } from "node:crypto";
import { and, asc, eq, gt, sql } from "drizzle-orm";
import * as z from "zod";
import type { Db } from "@/db/client";
import { invitation, owner, user, viewerMembership } from "@/db/schema";
import type { Clock, Person } from ".";
import { can, canBecomeViewer, resolveAccess } from "./access";

// Invitations: the Owner offers Viewer access to one email address and gets back a link
// to send themselves. The link is single-use, lapses after 7 days, and is accepted only
// by a signed-in person whose verified email matches the invited one.

const lifetimeMs = 7 * 24 * 60 * 60 * 1000;

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export const invitationPath = (token: string) => `/invitations/${token}`;

export type InvitationRefusal =
  | "notFound"
  | "used"
  | "cancelled"
  | "expired"
  | "wrongEmail"
  | "isOwner"
  | "isViewer";

// Postgres's unique_violation, which Drizzle wraps as the error's cause.
const isUniqueViolation = (error: unknown): boolean =>
  error instanceof Error &&
  ((error as { code?: unknown }).code === "23505" || isUniqueViolation(error.cause));

type Found = Pick<typeof invitation.$inferSelect, "status" | "expiresAt" | "email"> & { ownerName: string };

// Why nobody can accept this link now, or null if it's still open. Checked before the
// person's email, so a used or lapsed link says so whoever opens it, even signed out.
function linkRefusal(found: Found | undefined, now: Date): InvitationRefusal | null {
  if (!found) return "notFound";
  if (found.status === "accepted") return "used";
  if (found.status === "cancelled") return "cancelled";
  if (found.expiresAt <= now) return "expired";
  return null;
}

// Why this person can't accept this Invitation now, or null if they can.
function refusalFor(found: Found | undefined, person: Person, now: Date): InvitationRefusal | null {
  const refusal = linkRefusal(found, now);
  if (refusal) return refusal;
  if (!person.emailVerified || normalizeEmail(person.email) !== found!.email) return "wrongEmail";
  return null;
}

export type InvitationView =
  | { state: "signInRequired" }
  | { state: "acceptable"; ownerName: string }
  | { state: "refused"; reason: InvitationRefusal };

export function createInvitations(deps: { db: Db; clock: Clock }) {
  const { db, clock } = deps;

  // The access check for every Owner-only command and query here: the person's Owner, or null.
  const ownerAccess = async (person: Person) => {
    const access = await resolveAccess(db, person);
    return can(access, "manageViewers") ? access : null;
  };

  const findByToken = async (token: string): Promise<Found | undefined> =>
    (
      await db
        .select({
          status: invitation.status,
          expiresAt: invitation.expiresAt,
          email: invitation.email,
          ownerName: user.name,
        })
        .from(invitation)
        .innerJoin(owner, eq(owner.id, invitation.ownerId))
        .innerJoin(user, eq(user.id, owner.userId))
        .where(eq(invitation.tokenHash, hashToken(token)))
    )[0];

  // What the Invitation link's page shows. The person is null when signed out.
  async function invitationView(person: Person | null, token: string): Promise<InvitationView> {
    const found = await findByToken(token);
    const now = clock.now();
    const refusal = person ? refusalFor(found, person, now) : linkRefusal(found, now);
    if (refusal) return { state: "refused", reason: refusal };
    // Not even the Owner's name until the invited account signs in, so a forwarded
    // link tells its holder nothing about whose search it is.
    if (!person) return { state: "signInRequired" };
    const eligible = await canBecomeViewer(db, person);
    if (!eligible.ok) return { state: "refused", reason: eligible.reason };
    return { state: "acceptable", ownerName: found!.ownerName };
  }

  return {
    invitationView,

    async createInvitation(
      person: Person,
      email: string,
    ): Promise<{ ok: true; path: string } | { ok: false; reason: "noAccess" | "invalidEmail" }> {
      const access = await ownerAccess(person);
      if (!access) return { ok: false, reason: "noAccess" };
      const parsed = z.email().safeParse(normalizeEmail(email));
      if (!parsed.success) return { ok: false, reason: "invalidEmail" };

      const token = randomBytes(32).toString("base64url");
      const now = clock.now();
      await db.insert(invitation).values({
        ownerId: access.ownerId,
        email: parsed.data,
        tokenHash: hashToken(token),
        expiresAt: new Date(now.getTime() + lifetimeMs),
        createdAt: now,
      });
      return { ok: true, path: invitationPath(token) };
    },

    async acceptInvitation(
      person: Person,
      token: string,
    ): Promise<{ ok: true } | { ok: false; reason: InvitationRefusal }> {
      const now = clock.now();
      const refusal = refusalFor(await findByToken(token), person, now);
      if (refusal) return { ok: false, reason: refusal };
      // Not atomic with the claim below: an Owner row landing in between would make this
      // person both. Only the database can rule that out (#45).
      const eligible = await canBecomeViewer(db, person);
      if (!eligible.ok) return eligible;

      // Claiming the Invitation and inserting the membership is one statement, so it's
      // atomic on every driver (Neon's HTTP driver has no transactions): a second accept
      // finds nothing pending, and a unique violation (already a Viewer) undoes the claim.
      const claimed = db.$with("claimed").as(
        db
          .update(invitation)
          .set({ status: "accepted" })
          .where(
            and(
              eq(invitation.tokenHash, hashToken(token)),
              eq(invitation.status, "pending"),
              gt(invitation.expiresAt, now),
              eq(invitation.email, normalizeEmail(person.email)),
            ),
          )
          .returning({ ownerId: invitation.ownerId }),
      );
      const inserted = await db
        .with(claimed)
        .insert(viewerMembership)
        .select(
          // Drizzle wants every column, in table order.
          db
            .select({
              id: sql<string>`gen_random_uuid()`.as("id"),
              ownerId: claimed.ownerId,
              userId: sql<string>`${person.userId}`.as("user_id"),
              createdAt: sql<Date>`${now.toISOString()}::timestamptz`.as("created_at"),
            })
            .from(claimed),
        )
        .returning({ id: viewerMembership.id })
        .catch((error: unknown) => {
          // Another Invitation of theirs was accepted since canBecomeViewer ran.
          if (isUniqueViolation(error)) return "isViewer" as const;
          throw error;
        });
      if (inserted === "isViewer") return { ok: false, reason: "isViewer" };
      if (inserted.length === 1) return { ok: true };
      // Someone else's accept or a cancel landed since the check above.
      return { ok: false, reason: refusalFor(await findByToken(token), person, now) ?? "used" };
    },

    // Who can see the Owner's search, and who has an unused, unexpired link to.
    async viewersView(person: Person): Promise<ViewersView> {
      const access = await ownerAccess(person);
      if (!access) return { access: "none" };
      const pendingInvitations = await db
        .select({ id: invitation.id, email: invitation.email, expiresAt: invitation.expiresAt })
        .from(invitation)
        .where(
          and(
            eq(invitation.ownerId, access.ownerId),
            eq(invitation.status, "pending"),
            gt(invitation.expiresAt, clock.now()),
          ),
        )
        .orderBy(asc(invitation.createdAt), asc(invitation.id));
      const viewers = await db
        .select({ userId: user.id, name: user.name, email: user.email })
        .from(viewerMembership)
        .innerJoin(user, eq(user.id, viewerMembership.userId))
        .where(eq(viewerMembership.ownerId, access.ownerId))
        .orderBy(asc(user.name), asc(user.id));
      return { access: "owner", pendingInvitations, viewers };
    },

    // Stops an unused link working. Scoped to the Owner, so another Owner's id is "notFound".
    async cancelInvitation(person: Person, invitationId: string): Promise<OwnerCommandResult> {
      const access = await ownerAccess(person);
      if (!access) return { ok: false, reason: "noAccess" };
      const cancelled = await db
        .update(invitation)
        .set({ status: "cancelled" })
        .where(
          and(
            eq(invitation.id, invitationId),
            eq(invitation.ownerId, access.ownerId),
            eq(invitation.status, "pending"),
          ),
        )
        .returning({ id: invitation.id });
      return cancelled.length ? { ok: true } : { ok: false, reason: "notFound" };
    },

    // Deletes the membership. resolveAccess reads it fresh on every request, so the
    // Viewer loses access on their next one, even mid-session.
    async revokeViewer(person: Person, viewerUserId: string): Promise<OwnerCommandResult> {
      const access = await ownerAccess(person);
      if (!access) return { ok: false, reason: "noAccess" };
      const revoked = await db
        .delete(viewerMembership)
        .where(and(eq(viewerMembership.userId, viewerUserId), eq(viewerMembership.ownerId, access.ownerId)))
        .returning({ id: viewerMembership.id });
      return revoked.length ? { ok: true } : { ok: false, reason: "notFound" };
    },
  };
}

export type ViewersView =
  | {
      access: "owner";
      pendingInvitations: { id: string; email: string; expiresAt: Date }[];
      viewers: { userId: string; name: string; email: string }[];
    }
  | { access: "none" };

type OwnerCommandResult = { ok: true } | { ok: false; reason: "noAccess" | "notFound" };
