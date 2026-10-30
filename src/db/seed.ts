import type { Db } from "./client";
import { interviewLoop, owner, user } from "./schema";

// Synthetic data only: invented people and companies, example.com addresses.

export const seedPeople = {
  owner: { id: "user-owner", name: "Avery Example", email: "avery@example.com" },
  otherOwner: { id: "user-other-owner", name: "Rowan Example", email: "rowan@example.com" },
  stranger: { id: "user-stranger", name: "Sam Example", email: "sam@example.com" },
} as const;

// Seeds the configured Owner's Google user (not yet an Owner: first sign-in makes
// them one), a second Owner with Interview Loops, and a stranger, so tests can
// prove that one Owner's data never reaches another Owner's people.
export async function seed(db: Db) {
  const { owner: ownerPerson, otherOwner, stranger } = seedPeople;
  await db.insert(user).values([
    { ...ownerPerson, emailVerified: true },
    { ...otherOwner, emailVerified: true },
    { ...stranger, emailVerified: true },
  ]);
  const [other] = await db.insert(owner).values({ userId: otherOwner.id }).returning();
  await db.insert(interviewLoop).values([
    { ownerId: other.id, company: "Quillfeather", role: "Senior Engineer" },
    { ownerId: other.id, company: "Lumen Ridge", role: "Staff Engineer" },
  ]);
}
