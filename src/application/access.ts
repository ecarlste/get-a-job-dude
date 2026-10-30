import { eq } from "drizzle-orm";
import type { Db } from "@/db/client";
import { owner } from "@/db/schema";
import type { Person } from ".";

// The one server-side access check: signed-in person → their Owner → role.
// Every application-layer read and write resolves access here first.

export type Access = { role: "owner"; ownerId: string } | { role: "none" };

export async function resolveAccess(db: Db, person: Person): Promise<Access> {
  const [ownerRow] = await db.select().from(owner).where(eq(owner.userId, person.userId));
  return ownerRow ? { role: "owner", ownerId: ownerRow.id } : { role: "none" };
}
