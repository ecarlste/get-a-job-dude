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
    throw new Error("E2E_TEST_MODE needs a DATABASE_URL on localhost. Refusing to start.");
  }
  if (!env.E2E_NOW) return { enabled: true };
  const now = new Date(env.E2E_NOW);
  if (Number.isNaN(now.getTime())) throw new Error(`E2E_NOW is not a valid instant: ${env.E2E_NOW}`);
  return { enabled: true, now };
}

const loopbackHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);

// True only for a Postgres URL whose host is this machine.
export function isLocalDatabase(url: string | undefined): boolean {
  if (!url) return false;
  try {
    return loopbackHosts.has(new URL(url).hostname);
  } catch {
    return false;
  }
}
