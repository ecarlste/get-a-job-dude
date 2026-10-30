import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import type * as schema from "./schema";

// Any Postgres-backed Drizzle database over our schema: Neon in the app, node-postgres
// for the end-to-end run, PGlite in unit tests.
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;
