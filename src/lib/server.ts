import "server-only";
import { neon } from "@neondatabase/serverless";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-http";
import { headers } from "next/headers";
import { createApplication, systemClock, toPerson, type Person } from "@/application";
import type { Db } from "@/db/client";
import * as schema from "@/db/schema";
import { createAuth } from "./auth";
import { readTestMode } from "./test-mode";

// Production wiring: the database, Better Auth, and the application layer.

const testMode = readTestMode(process.env);

// Neon's HTTP driver for real deployments; plain Postgres for the throwaway end-to-end
// database, imported only in test mode so deployments never load node-postgres.
const db: Db = testMode.enabled
  ? (await import("drizzle-orm/node-postgres")).drizzle(process.env.DATABASE_URL!, { schema })
  : drizzleNeon(neon(process.env.DATABASE_URL!), { schema });

const fixedNow = testMode.enabled ? testMode.now : undefined;

export const application = createApplication({
  db,
  clock: fixedNow ? { now: () => fixedNow } : systemClock,
  ownerEmail: process.env.OWNER_EMAIL ?? "",
});

export const auth = createAuth({
  db,
  application,
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
  },
  testSignIn: testMode.enabled,
});

// The signed-in person for this request, or null.
export async function currentPerson(): Promise<Person | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  return session ? toPerson(session.user) : null;
}
