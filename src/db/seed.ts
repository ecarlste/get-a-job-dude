import type { Db } from "./client";
import { interviewLoop, owner, user, viewerMembership } from "./schema";

// Synthetic data only: invented people and companies, example.com addresses.

export const seedPeople = {
  owner: { id: "user-owner", name: "Avery Example", email: "avery@example.com" },
  viewer: { id: "user-viewer", name: "Jordan Example", email: "jordan@example.com" },
  otherOwner: { id: "user-other-owner", name: "Rowan Example", email: "rowan@example.com" },
  stranger: { id: "user-stranger", name: "Sam Example", email: "sam@example.com" },
} as const;

// A fresh test database: the committed migrations, then the seed. Each driver has
// its own migrator, so the caller passes it in (PGlite for unit tests, node-postgres for e2e).
export async function migrateAndSeed<D extends Db>(
  db: D,
  migrate: (db: D, config: { migrationsFolder: string }) => Promise<unknown>,
) {
  await migrate(db, { migrationsFolder: "drizzle" });
  await seed(db);
}

// Seeds the Owner with an open and an ended Interview Loop and an accepted Viewer, a second Owner
// with their own Interview Loops, and a stranger, so tests can prove Viewer
// rules and that one Owner's data never reaches another Owner's people.
export async function seed(db: Db) {
  const { owner: ownerPerson, viewer, otherOwner, stranger } = seedPeople;
  await db.insert(user).values(
    [ownerPerson, viewer, otherOwner, stranger].map((p) => ({ ...p, emailVerified: true })),
  );

  const [avery] = await db.insert(owner).values({ userId: ownerPerson.id }).returning();
  await db.insert(viewerMembership).values({ ownerId: avery.id, userId: viewer.id });
  await db.insert(interviewLoop).values([
    { ownerId: avery.id, company: "Brightwater", role: "Platform Engineer" },
    { ownerId: avery.id, company: "Alder & Finch", role: "Senior Engineer", ending: "withdrawn" },
  ]);

  const [rowan] = await db.insert(owner).values({ userId: otherOwner.id }).returning();
  await db.insert(interviewLoop).values([
    { ownerId: rowan.id, company: "Quillfeather", role: "Senior Engineer" },
    { ownerId: rowan.id, company: "Lumen Ridge", role: "Staff Engineer" },
  ]);
}
