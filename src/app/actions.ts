"use server";

import { revalidatePath } from "next/cache";
import type { CommandResult, LoopEnding, LoopFactErrors, LoopFacts } from "@/application";
import { application, currentPerson } from "@/lib/server";

// Server actions for the main view. Each passes the signed-in person to the
// application layer, which does the access check; these only adapt forms.

// savedAt changes on every successful save, so the form can close even when saving twice.
export type LoopFormState = { fieldErrors?: LoopFactErrors; error?: string; savedAt?: number };

const factsFrom = (form: FormData): LoopFacts => {
  const field = (name: string) => String(form.get(name) ?? "");
  return {
    company: field("company"),
    role: field("role"),
    location: field("location"),
    jobLink: field("jobLink"),
    appliedOn: field("appliedOn"),
    people: field("people"),
  };
};

const messages = {
  forbidden: "You can't change Interview Loops.",
  "not-found": "That Interview Loop no longer exists.",
};

function toFormState(result: CommandResult): LoopFormState {
  if (result.ok) {
    revalidatePath("/");
    return { savedAt: Date.now() };
  }
  if (result.error === "invalid") return { fieldErrors: result.fieldErrors };
  return { error: messages[result.error] };
}

async function signedIn() {
  const person = await currentPerson();
  if (!person) throw new Error("Not signed in");
  return person;
}

export async function saveInterviewLoop(
  loopId: string | null,
  _previous: LoopFormState,
  form: FormData,
): Promise<LoopFormState> {
  const person = await signedIn();
  const facts = factsFrom(form);
  return toFormState(
    loopId
      ? await application.editInterviewLoop(person, loopId, facts)
      : await application.createInterviewLoop(person, facts),
  );
}

export async function deleteInterviewLoop(loopId: string): Promise<LoopFormState> {
  return toFormState(await application.deleteInterviewLoop(await signedIn(), loopId));
}

export async function setLoopEnding(loopId: string, ending: LoopEnding): Promise<LoopFormState> {
  return toFormState(await application.setLoopEnding(await signedIn(), loopId, ending));
}
