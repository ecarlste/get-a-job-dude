import { asc, eq, sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import { interviewLoop, owner } from "@/db/schema";
import { can, canBecomeOwner, resolveAccess, type Role } from "./access";
import { interviewLoopCommands, type LoopFacts } from "./interview-loops";
import type { LoopEnding } from "./loop-ending";

export type { CommandResult, LoopFactErrors, LoopFacts } from "./interview-loops";
export type { LoopEnding } from "./loop-ending";

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

export type InterviewLoopRow = Omit<LoopFacts, "appliedOn"> & {
  id: string;
  appliedOn: string | null;
  ending: LoopEnding;
  jobLeadId: string | null;
};

export type MainView =
  | {
      access: Role;
      greetingName: string;
      now: Date;
      canChangeLoops: boolean;
      interviewLoops: InterviewLoopRow[];
    }
  | { access: "none" };

export type Application = ReturnType<typeof createApplication>;

const normalizeEmail = (email: string) => email.trim().toLowerCase();

export function createApplication(deps: { db: Db; clock: Clock; ownerEmail: string }) {
  const { db, clock } = deps;
  const ownerEmail = normalizeEmail(deps.ownerEmail);

  return {
    ...interviewLoopCommands(db),

    // Called on every sign-in. The configured Owner email becomes the Owner the first time,
    // unless that person is already a Viewer: nobody is both.
    async recordSignIn(person: Person) {
      const isOwnerEmail = ownerEmail !== "" && normalizeEmail(person.email) === ownerEmail;
      if (!person.emailVerified || !isOwnerEmail) return;
      if (!(await canBecomeOwner(db, person))) {
        console.error(`Person ${person.userId} has the configured Owner email but is a Viewer. Not making them the Owner.`);
        return;
      }
      // Not atomic with the check above: a Viewer membership landing in between would make
      // this person both. Only the database can rule that out (#45).
      await db.insert(owner).values({ userId: person.userId }).onConflictDoNothing();
    },

    async mainView(person: Person): Promise<MainView> {
      const access = await resolveAccess(db, person);
      if (!can(access, "readSearch")) return { access: "none" };
      // Open loops first, then ended ones.
      const interviewLoops = await db
        .select({
          id: interviewLoop.id,
          company: interviewLoop.company,
          role: interviewLoop.role,
          location: interviewLoop.location,
          jobLink: interviewLoop.jobLink,
          appliedOn: interviewLoop.appliedOn,
          people: interviewLoop.people,
          ending: interviewLoop.ending,
          jobLeadId: interviewLoop.jobLeadId,
        })
        .from(interviewLoop)
        .where(eq(interviewLoop.ownerId, access.ownerId))
        .orderBy(sql`${interviewLoop.ending} <> 'open'`, asc(interviewLoop.company), asc(interviewLoop.id));
      return {
        access: access.role,
        greetingName: person.name,
        now: clock.now(),
        canChangeLoops: can(access, "changeLoops"),
        interviewLoops,
      };
    },
  };
}
