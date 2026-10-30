import { eq } from "drizzle-orm";
import type { Db } from "@/db/client";
import { interviewLoop, owner, viewerMembership } from "@/db/schema";
import { can, resolveAccess, type Role } from "./access";

// The application layer: Owner-scoped commands and queries, each taking the
// signed-in person. The UI reads and writes only through here.

export type Person = {
  userId: string;
  name: string;
  email: string;
  emailVerified: boolean;
};

// A signed-in person, from the auth library's user record.
export function toPerson(u: { id: string; name: string; email: string; emailVerified: boolean }): Person {
  return { userId: u.id, name: u.name, email: u.email, emailVerified: u.emailVerified };
}

export type Clock = { now(): Date };

export const systemClock: Clock = { now: () => new Date() };

export type MainView =
  | {
      access: Role;
      greetingName: string;
      now: Date;
      interviewLoops: { id: string; company: string; role: string }[];
    }
  | { access: "none" };

export type Application = ReturnType<typeof createApplication>;

const normalizeEmail = (email: string) => email.trim().toLowerCase();

export function createApplication(deps: { db: Db; clock: Clock; ownerEmail: string }) {
  const { db, clock } = deps;
  const ownerEmail = normalizeEmail(deps.ownerEmail);

  return {
    // Called on every sign-in. The configured Owner email becomes the Owner the first time,
    // unless that person is already a Viewer: nobody is both.
    async recordSignIn(person: Person) {
      const isOwnerEmail = ownerEmail !== "" && normalizeEmail(person.email) === ownerEmail;
      if (!person.emailVerified || !isOwnerEmail) return;
      const [membership] = await db
        .select({ id: viewerMembership.id })
        .from(viewerMembership)
        .where(eq(viewerMembership.userId, person.userId));
      if (membership) return;
      await db.insert(owner).values({ userId: person.userId }).onConflictDoNothing();
    },

    async mainView(person: Person): Promise<MainView> {
      const access = await resolveAccess(db, person);
      if (!can(access, "readSearch")) return { access: "none" };
      const interviewLoops = await db
        .select({ id: interviewLoop.id, company: interviewLoop.company, role: interviewLoop.role })
        .from(interviewLoop)
        .where(eq(interviewLoop.ownerId, access.ownerId));
      return { access: access.role, greetingName: person.name, now: clock.now(), interviewLoops };
    },
  };
}
