import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import * as schema from "../src/db/schema";
import { migrateAndSeed } from "../src/db/seed";
import { e2eDatabaseUrl } from "./database";

// Wipes the throwaway database, applies the committed migrations, and loads the synthetic seed.
export default async function globalSetup() {
  const db = drizzle(e2eDatabaseUrl(), { schema });
  try {
    await db.execute(sql`drop schema if exists drizzle cascade`);
    await db.execute(sql`drop schema if exists public cascade`);
    await db.execute(sql`create schema public`);
    await migrateAndSeed(db, migrate);
  } finally {
    await db.$client.end();
  }
}
