import { eq } from "drizzle-orm";
import type { Db } from "@/db/client";
import { owner, user, viewerMembership } from "@/db/schema";
import type { Person } from ".";

// The one server-side access check: signed-in person → their Owner → role.
// Every application-layer read and write resolves access here first, and asks
// for a named permission rather than checking the role itself.

export type Role = "owner" | "viewer";

export type Access = { role: Role; ownerId: string } | { role: "none" };

// Grows with each Owner-only or Viewer capability.
export type Permission = "readSearch" | "manageViewers";

const permissions: Record<Role, readonly Permission[]> = {
  owner: ["readSearch", "manageViewers"],
  viewer: ["readSearch"],
};

// Resolved fresh on every call, so a revoked Viewer loses access on their next request.
// A person belongs to at most one search: they own it, or they view exactly one
// Owner's (both owner.user_id and viewer_membership.user_id are unique). One who
// somehow holds both gets no access (and a logged error) rather than silently
// being given one of them, so they still see "No access" and can sign out.
export async function resolveAccess(db: Db, person: Person): Promise<Access> {
  const [row] = await db
    .select({ ownId: owner.id, viewsId: viewerMembership.ownerId })
    .from(user)
    .leftJoin(owner, eq(owner.userId, user.id))
    .leftJoin(viewerMembership, eq(viewerMembership.userId, user.id))
    .where(eq(user.id, person.userId));

  if (row?.ownId && row.viewsId) {
    console.error(`Person ${person.userId} is both an Owner and a Viewer. Refusing access.`);
    return { role: "none" };
  }
  if (row?.ownId) return { role: "owner", ownerId: row.ownId };
  if (row?.viewsId) return { role: "viewer", ownerId: row.viewsId };
  return { role: "none" };
}

// Whether sign-in may make this person the Owner: not when they're already a
// Viewer, since nobody is both.
export async function canBecomeOwner(db: Db, person: Person): Promise<boolean> {
  const [membership] = await db
    .select({ id: viewerMembership.id })
    .from(viewerMembership)
    .where(eq(viewerMembership.userId, person.userId));
  return !membership;
}

// Whether accepting an Invitation may make this person a Viewer: not when they're an
// Owner (the reverse of canBecomeOwner), nor already some Owner's Viewer.
export async function canBecomeViewer(
  db: Db,
  person: Person,
): Promise<{ ok: true } | { ok: false; reason: "isOwner" | "isViewer" }> {
  const access = await resolveAccess(db, person);
  if (access.role === "owner") return { ok: false, reason: "isOwner" };
  if (access.role === "viewer") return { ok: false, reason: "isViewer" };
  return { ok: true };
}

type Granted = Extract<Access, { role: Role }>;
declare const permitted: unique symbol;

// One-sided narrowing: true narrows to an Owner or Viewer, false narrows nothing.
// A plain `access is Granted` would also claim a refused Owner or Viewer has role
// "none"; the brand stops TypeScript narrowing them out of the false branch.
export function can(
  access: Access,
  permission: Permission,
): access is Granted & { readonly [permitted]: true } {
  return access.role !== "none" && permissions[access.role].includes(permission);
}
