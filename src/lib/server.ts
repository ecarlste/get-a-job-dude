import "server-only";
import { neon } from "@neondatabase/serverless";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";
import { headers } from "next/headers";
import { createApplication, systemClock, toPerson, type Person } from "@/application";
import * as schema from "@/db/schema";

// Production wiring: the Neon database, Better Auth, and the application layer.

const db = drizzle(neon(process.env.DATABASE_URL!), { schema });

export const application = createApplication({
  db,
  clock: systemClock,
  ownerEmail: process.env.OWNER_EMAIL ?? "",
});

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg", schema }),
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
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
  plugins: [nextCookies()],
});

// The signed-in person for this request, or null.
export async function currentPerson(): Promise<Person | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  return session ? toPerson(session.user) : null;
}
