import { betterAuth, type BetterAuthPlugin } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { createAuthEndpoint } from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";
import { nextCookies } from "better-auth/next-js";
import { eq } from "drizzle-orm";
import * as z from "zod";
import { toPerson, type Application } from "@/application";
import type { Db } from "@/db/client";
import * as schema from "@/db/schema";

// Better Auth: Google sign-in, plus the test-only sign-in when the test flag is set.

export function createAuth(deps: {
  db: Db;
  application: Application;
  secret?: string;
  baseURL?: string;
  google: { clientId: string; clientSecret: string };
  testSignIn: boolean;
}) {
  const { db, application } = deps;
  return betterAuth({
    secret: deps.secret,
    baseURL: deps.baseURL,
    database: drizzleAdapter(db, { provider: "pg", schema }),
    socialProviders: {
      google: {
        ...deps.google,
        // Basic openid/email/profile only, kept apart from any later Gmail consent.
        includeGrantedScopes: false,
      },
    },
    databaseHooks: {
      session: {
        create: {
          after: async (session) => {
            const [signedIn] = await db
              .select()
              .from(schema.user)
              .where(eq(schema.user.id, session.userId));
            if (signedIn) await application.recordSignIn(toPerson(signedIn));
          },
        },
      },
    },
    plugins: [...(deps.testSignIn ? [testSignInPlugin()] : []), nextCookies()],
  });
}

// POST /api/auth/test/sign-in { email } signs in an existing (seeded) person and
// redirects to the main view. A POST, so another site can't sign a browser in with
// a link or image. Registered only when the test flag is set, so the route doesn't
// exist otherwise.
function testSignInPlugin() {
  return {
    id: "test-sign-in",
    endpoints: {
      testSignIn: createAuthEndpoint(
        "/test/sign-in",
        { method: "POST", body: z.object({ email: z.string() }) },
        async (ctx) => {
          const found = await ctx.context.internalAdapter.findUserByEmail(ctx.body.email);
          if (!found) throw ctx.error("NOT_FOUND", { message: "No such seeded person" });
          const session = await ctx.context.internalAdapter.createSession(found.user.id);
          await setSessionCookie(ctx, { session, user: found.user });
          throw ctx.redirect("/");
        },
      ),
    },
  } satisfies BetterAuthPlugin;
}
