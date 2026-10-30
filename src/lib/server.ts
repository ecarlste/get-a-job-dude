import "server-only";
import { neon } from "@neondatabase/serverless";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-http";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { headers } from "next/headers";
import { createApplication, systemClock, toPerson, type Person } from "@/application";
import type { Db } from "@/db/client";
import * as schema from "@/db/schema";
import { createAuth } from "./auth";
import { readTestMode } from "./test-mode";

// Production wiring: the database, Better Auth, and the application layer.

const testMode = readTestMode(process.env);

// Neon's HTTP driver for Neon; plain Postgres (the throwaway end-to-end database) otherwise.
function connect(url: string): Db {
  return new URL(url).hostname.endsWith(".neon.tech")
    ? drizzleNeon(neon(url), { schema })
    : drizzlePg(url, { schema });
}

const db = connect(process.env.DATABASE_URL!);

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
