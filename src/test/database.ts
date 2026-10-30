import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import type { Db } from "@/db/client";
import * as schema from "@/db/schema";
import { migrateAndSeed } from "@/db/seed";

// An in-process Postgres, migrated from the committed migrations and seeded.
export async function createTestDatabase(): Promise<Db> {
  const db = drizzle(new PGlite(), { schema });
  await migrateAndSeed(db, migrate);
  return db;
}
