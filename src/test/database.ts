import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import type { Db } from "@/db/client";
import * as schema from "@/db/schema";
import { migrateAndSeed } from "@/db/seed";

// Migrated and seeded once per test file (each file gets its own module), so
// the cost of a test doesn't grow with every migration we add.
let template: Promise<PGlite> | undefined;

async function migratedAndSeeded(): Promise<PGlite> {
  const client = new PGlite();
  await migrateAndSeed(drizzle(client, { schema }), migrate);
  return client;
}

// An in-process Postgres with the committed migrations and the seed: a fresh
// copy of this file's template, so tests can't see each other's writes.
export async function createTestDatabase(): Promise<Db> {
  template ??= migratedAndSeeded();
  const client = (await (await template).clone()) as PGlite;
  return drizzle(client, { schema });
}
