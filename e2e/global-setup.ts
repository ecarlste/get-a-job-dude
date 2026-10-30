import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import * as schema from "../src/db/schema";
import { seed } from "../src/db/seed";

// Wipes the throwaway database, applies the committed migrations, and loads the synthetic seed.
export default async function globalSetup() {
  const db = drizzle(process.env.DATABASE_URL!, { schema });
  try {
    await db.execute(sql`drop schema if exists drizzle cascade`);
    await db.execute(sql`drop schema public cascade`);
    await db.execute(sql`create schema public`);
    await migrate(db, { migrationsFolder: "drizzle" });
    await seed(db);
  } finally {
    await db.$client.end();
  }
}
