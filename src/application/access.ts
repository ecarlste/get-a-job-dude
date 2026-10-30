import { asc, eq } from "drizzle-orm";
import type { Db } from "@/db/client";
import { owner, viewerMembership } from "@/db/schema";
import type { Person } from ".";

// The one server-side access check: signed-in person → their Owner → role.
// Every application-layer read and write resolves access here first, and asks
// for a named permission rather than checking the role itself.

export type Role = "owner" | "viewer";

export type Access = { role: Role; ownerId: string } | { role: "none" };

// Grows with each Owner-only or Viewer capability.
export type Permission = "readSearch";

const permissions: Record<Role, readonly Permission[]> = {
  owner: ["readSearch"],
  viewer: ["readSearch"],
};

// Resolved fresh on every call, so a revoked Viewer loses access on their next request.
export async function resolveAccess(db: Db, person: Person): Promise<Access> {
  const [ownerRow] = await db.select().from(owner).where(eq(owner.userId, person.userId));
  if (ownerRow) return { role: "owner", ownerId: ownerRow.id };

  const [membership] = await db
    .select()
    .from(viewerMembership)
    .where(eq(viewerMembership.userId, person.userId))
    .orderBy(asc(viewerMembership.createdAt));
  if (membership) return { role: "viewer", ownerId: membership.ownerId };

  return { role: "none" };
}

export function can(access: Access, permission: Permission): access is Access & { role: Role } {
  return access.role !== "none" && permissions[access.role].includes(permission);
}
