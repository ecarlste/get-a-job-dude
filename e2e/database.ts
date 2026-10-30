import { isLocalDatabase } from "../src/lib/test-mode";

// The throwaway database the end-to-end run wipes. Read from its own variable,
// never DATABASE_URL, so a shell pointed at Neon can't be reset by accident.
export function e2eDatabaseUrl(): string {
  const url = process.env.E2E_DATABASE_URL;
  if (!url) throw new Error("Set E2E_DATABASE_URL to a throwaway Postgres on localhost.");
  if (!isLocalDatabase(url)) {
    throw new Error("E2E_DATABASE_URL must be on localhost: the end-to-end run wipes it.");
  }
  return url;
}
