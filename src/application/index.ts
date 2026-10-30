import { eq } from "drizzle-orm";
import type { Db } from "@/db/client";
import { interviewLoop, owner } from "@/db/schema";

// The application layer: Owner-scoped commands and queries, each taking the
// signed-in person. The UI reads and writes only through here.

export type Person = {
  userId: string;
  name: string;
  email: string;
  emailVerified: boolean;
};

export type Clock = { now(): Date };

export const systemClock: Clock = { now: () => new Date() };

export type MainView =
  | {
      access: "owner";
      greetingName: string;
      now: Date;
      interviewLoops: { id: string; company: string; role: string }[];
    }
  | { access: "none" };

export type Application = ReturnType<typeof createApplication>;

export function createApplication(deps: { db: Db; clock: Clock; ownerEmail: string }) {
  const { db, clock } = deps;

  return {
    // Called on every sign-in. The configured Owner email becomes the Owner the first time.
    async signedIn(person: Person) {
      const isOwnerEmail =
        deps.ownerEmail !== "" &&
        person.email.trim().toLowerCase() === deps.ownerEmail.trim().toLowerCase();
      if (!person.emailVerified || !isOwnerEmail) return;
      await db.insert(owner).values({ userId: person.userId }).onConflictDoNothing();
    },

    async mainView(person: Person): Promise<MainView> {
      const [own] = await db.select().from(owner).where(eq(owner.userId, person.userId));
      if (!own) return { access: "none" };
      const interviewLoops = await db
        .select({ id: interviewLoop.id, company: interviewLoop.company, role: interviewLoop.role })
        .from(interviewLoop)
        .where(eq(interviewLoop.ownerId, own.id));
      return { access: "owner", greetingName: person.name, now: clock.now(), interviewLoops };
    },
  };
}
