import { acceptInvitation } from "@/app/actions";
import type { InvitationRefusal } from "@/application/invitations";
import { SignInButton, SignOutButton } from "@/components/auth-buttons";
import { Button } from "@/components/ui/button";
import { application, currentPerson } from "@/lib/server";

const askForNew = "Ask the person who invited you for a new Invitation.";

// What each refused link says. None of them repeats the invited email, so a forwarded
// link tells its holder nothing about who it was for.
const refusals: Record<InvitationRefusal, { title: string; detail: string; signOut?: true }> = {
  notFound: { title: "This Invitation link isn't valid", detail: `Check the link. ${askForNew}` },
  used: { title: "This Invitation has already been used", detail: askForNew },
  cancelled: { title: "This Invitation was cancelled", detail: askForNew },
  expired: { title: "This Invitation has expired", detail: askForNew },
  wrongEmail: {
    title: "This Invitation is for a different email",
    detail: "Sign out, then sign in with the Google account for the email you were invited at. Google must have verified that email.",
    signOut: true,
  },
  isOwner: { title: "You already own a search", detail: "An Owner can't also be a Viewer.", signOut: true },
  isViewer: { title: "You're already a Viewer", detail: "A person can view only one search.", signOut: true },
};

export default async function InvitationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const person = await currentPerson();
  const view = await application.invitationView(person, token);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
      {view.state === "refused" ? (
        <>
          <h1 className="text-xl font-semibold">{refusals[view.reason].title}</h1>
          <p className="text-muted-foreground">{refusals[view.reason].detail}</p>
          {person && refusals[view.reason].signOut && <SignOutButton />}
        </>
      ) : view.state === "signInRequired" ? (
        <>
          <h1 className="text-xl font-semibold">You&apos;ve been invited to view a search</h1>
          <p className="text-muted-foreground">Sign in with the Google account for the email you were invited at.</p>
          <SignInButton callbackURL={`/invitations/${token}`} />
        </>
      ) : (
        <>
          <h1 className="text-xl font-semibold">{view.ownerName} invited you to view their search</h1>
          <form action={acceptInvitation.bind(null, token)}>
            <Button type="submit">Accept Invitation</Button>
          </form>
        </>
      )}
    </main>
  );
}
