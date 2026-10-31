"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { invitationPath } from "@/application/invitations";
import { application, currentPerson } from "@/lib/server";

// Server actions: each takes the signed-in person and goes through the application
// layer, which runs the access check. A signed-out caller is treated like a stranger.

export type InviteState =
  | { status: "idle" }
  | { status: "created"; email: string; link: string }
  | { status: "error"; message: string };

const inviteErrors = {
  noAccess: "Only the Owner can invite Viewers.",
  invalidEmail: "Enter an email address.",
};

export async function invite(_: InviteState, form: FormData): Promise<InviteState> {
  const person = await currentPerson();
  if (!person) return { status: "error", message: inviteErrors.noAccess };
  const email = String(form.get("email") ?? "");
  const created = await application.createInvitation(person, email);
  if (!created.ok) return { status: "error", message: inviteErrors[created.reason] };
  revalidatePath("/viewers");
  return { status: "created", email: email.trim(), link: new URL(created.path, await origin()).href };
}

export async function cancelInvitation(invitationId: string) {
  const person = await currentPerson();
  if (person) await application.cancelInvitation(person, invitationId);
  revalidatePath("/viewers");
}

export async function revokeViewer(viewerUserId: string) {
  const person = await currentPerson();
  if (person) await application.revokeViewer(person, viewerUserId);
  revalidatePath("/viewers");
}

// On success, on to the Owner's search. Otherwise back to the link's page, which says why.
export async function acceptInvitation(token: string) {
  const person = await currentPerson();
  if (person && (await application.acceptInvitation(person, token)).ok) redirect("/");
  redirect(invitationPath(token));
}

// This deployment's origin, as the browser reached it, for the link the Owner sends.
async function origin() {
  const h = await headers();
  return `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
}
