import { and, eq } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/db/client";
import { interviewLoop, loopEnding } from "@/db/schema";
import { can, resolveAccess } from "./access";
import type { Person } from ".";

// Interview Loop commands. Each resolves access first and refuses a person
// without the changeLoops permission.

export type LoopFacts = {
  company: string;
  role: string;
  location: string;
  jobLink: string;
  appliedOn: string;
  people: string;
};

export type LoopEnding = (typeof loopEnding.enumValues)[number];

export type LoopFactErrors = Partial<Record<keyof LoopFacts, string>>;

export type CommandResult<T = object> =
  | ({ ok: true } & T)
  | { ok: false; error: "forbidden" | "not-found" }
  | { ok: false; error: "invalid"; fieldErrors: LoopFactErrors };

const required = (label: string) => z.string().trim().min(1, `${label} is required`);

const loopFacts = z.object({
  company: required("Company"),
  role: required("Role"),
  location: z.string().trim(),
  jobLink: z.string().trim(),
  appliedOn: z.union([z.literal(""), z.iso.date("Applied date must be a date")]),
  people: z.string().trim(),
});

function parseFacts(input: LoopFacts) {
  const parsed = loopFacts.safeParse(input);
  if (parsed.success) return { ok: true as const, facts: { ...parsed.data, appliedOn: parsed.data.appliedOn || null } };
  const fieldErrors: LoopFactErrors = {};
  for (const issue of parsed.error.issues) {
    const field = issue.path[0] as keyof LoopFacts;
    fieldErrors[field] ??= issue.message;
  }
  return { ok: false as const, error: "invalid" as const, fieldErrors };
}

export function interviewLoopCommands(db: Db) {
  return {
    async createInterviewLoop(person: Person, input: LoopFacts): Promise<CommandResult<{ id: string }>> {
      const access = await resolveAccess(db, person);
      if (!can(access, "changeLoops")) return { ok: false, error: "forbidden" };
      const parsed = parseFacts(input);
      if (!parsed.ok) return parsed;
      const [created] = await db
        .insert(interviewLoop)
        .values({ ...parsed.facts, ownerId: access.ownerId })
        .returning({ id: interviewLoop.id });
      return { ok: true, id: created.id };
    },

    async editInterviewLoop(person: Person, loopId: string, input: LoopFacts): Promise<CommandResult> {
      const access = await resolveAccess(db, person);
      if (!can(access, "changeLoops")) return { ok: false, error: "forbidden" };
      const parsed = parseFacts(input);
      if (!parsed.ok) return parsed;
      const updated = await db
        .update(interviewLoop)
        .set(parsed.facts)
        .where(ownersLoop(access.ownerId, loopId))
        .returning({ id: interviewLoop.id });
      return updated.length ? { ok: true } : { ok: false, error: "not-found" };
    },

    // Any ending other than open ends the loop; open reopens it.
    async setLoopEnding(person: Person, loopId: string, ending: LoopEnding): Promise<CommandResult> {
      const access = await resolveAccess(db, person);
      if (!can(access, "changeLoops")) return { ok: false, error: "forbidden" };
      if (!loopEnding.enumValues.includes(ending)) throw new Error(`Unknown loop ending: ${ending}`);
      const updated = await db
        .update(interviewLoop)
        .set({ ending })
        .where(ownersLoop(access.ownerId, loopId))
        .returning({ id: interviewLoop.id });
      return updated.length ? { ok: true } : { ok: false, error: "not-found" };
    },

    async deleteInterviewLoop(person: Person, loopId: string): Promise<CommandResult> {
      const access = await resolveAccess(db, person);
      if (!can(access, "changeLoops")) return { ok: false, error: "forbidden" };
      const deleted = await db
        .delete(interviewLoop)
        .where(ownersLoop(access.ownerId, loopId))
        .returning({ id: interviewLoop.id });
      return deleted.length ? { ok: true } : { ok: false, error: "not-found" };
    },
  };
}

// A loop in this Owner's search. Another Owner's loop is indistinguishable from a missing one.
const ownersLoop = (ownerId: string, loopId: string) =>
  and(eq(interviewLoop.ownerId, ownerId), eq(interviewLoop.id, loopId));
