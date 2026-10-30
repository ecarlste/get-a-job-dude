// The end-to-end test flag. When set, the test-only sign-in exists and "now" can
// be fixed through E2E_NOW. It refuses to build or start on a Vercel deployment,
// or against any database that isn't on this machine (next.config.ts calls this),
// so the test-only sign-in can only ever hand out sessions for a local throwaway.
// Kept free of imports so next.config.ts can load it.

export type TestMode = { enabled: false } | { enabled: true; now?: Date };

export function readTestMode(env: Record<string, string | undefined>): TestMode {
  if (env.E2E_TEST_MODE !== "1") return { enabled: false };
  if (env.VERCEL) {
    throw new Error("E2E_TEST_MODE is set on a Vercel deployment. Refusing to start.");
  }
  if (!isLocalDatabase(env.DATABASE_URL)) {
    // `npm run e2e` passes E2E_DATABASE_URL through as DATABASE_URL, so name that too.
    throw new Error(
      "E2E_TEST_MODE needs a DATABASE_URL on localhost (for `npm run e2e`, set E2E_DATABASE_URL to a throwaway Postgres on localhost). Refusing to start.",
    );
  }
  if (!env.E2E_NOW) return { enabled: true };
  const now = new Date(env.E2E_NOW);
  if (Number.isNaN(now.getTime())) throw new Error(`E2E_NOW is not a valid instant: ${env.E2E_NOW}`);
  return { enabled: true, now };
}

const loopbackHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);

// Query parameters node-postgres lets override the URL's host.
const hostOverrides = new Set(["host", "hostaddr"]);

// True only for a Postgres URL whose host is this machine.
export function isLocalDatabase(url: string | undefined): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    const overridesHost = [...parsed.searchParams.keys()].some((k) => hostOverrides.has(k.toLowerCase()));
    // WHATWG URL only lowercases the host for special schemes, not postgres:.
    return !overridesHost && loopbackHosts.has(parsed.hostname.toLowerCase());
  } catch {
    return false;
  }
}
