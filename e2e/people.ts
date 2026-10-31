import { randomUUID } from "node:crypto";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "../src/db/schema";
import { e2eDatabaseUrl } from "./database";

// A new synthetic person with a verified Google email, unique to this test run, so tests
// that change someone's access (desktop and phone run at once) never share a person.
export async function createPerson(firstName: string) {
  const suffix = randomUUID().slice(0, 8);
  const person = { id: `e2e-${suffix}`, name: `${firstName} ${suffix}`, email: `${firstName.toLowerCase()}-${suffix}@example.com` };
  const db = drizzle(e2eDatabaseUrl(), { schema });
  try {
    await db.insert(schema.user).values({ ...person, emailVerified: true });
  } finally {
    await db.$client.end();
  }
  return person;
}
