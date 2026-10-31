import { neon } from "@neondatabase/serverless";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "../src/db/schema";
import { seed, seedPeople } from "../src/db/seed";

// Loads the synthetic seed into the preview database, once. Run by
// scripts/setup-deploy.sh after the migrations: PREVIEW_DATABASE_URL=... npx tsx scripts/seed-preview.ts
// Reads PREVIEW_DATABASE_URL rather than DATABASE_URL so it can't pick up another
// database from the shell by accident. Never point it at production.

const url = process.env.PREVIEW_DATABASE_URL;
if (!url) throw new Error("Set PREVIEW_DATABASE_URL to the preview database's connection string.");

const db = drizzle(neon(url), { schema });

const [seeded] = await db
  .select({ id: schema.user.id })
  .from(schema.user)
  .where(eq(schema.user.id, seedPeople.owner.id));

if (seeded) {
  console.log("Preview database already seeded; nothing to do.");
} else {
  await seed(db);
  console.log("Seeded the preview database with synthetic data.");
}
