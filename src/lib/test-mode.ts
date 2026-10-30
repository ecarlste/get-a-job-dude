// The end-to-end test flag. When set, the test-only sign-in exists and "now" can
// be fixed through E2E_NOW. A Vercel deployment refuses to build or start with it
// set (next.config.ts calls this), so it can only ever run locally or in CI.
// Kept free of imports so next.config.ts can load it.

export type TestMode = { enabled: false } | { enabled: true; now?: Date };

export function readTestMode(env: Record<string, string | undefined>): TestMode {
  if (env.E2E_TEST_MODE !== "1") return { enabled: false };
  if (env.VERCEL) {
    throw new Error("E2E_TEST_MODE is set on a Vercel deployment. Refusing to start.");
  }
  if (!env.E2E_NOW) return { enabled: true };
  const now = new Date(env.E2E_NOW);
  if (Number.isNaN(now.getTime())) throw new Error(`E2E_NOW is not a valid instant: ${env.E2E_NOW}`);
  return { enabled: true, now };
}
