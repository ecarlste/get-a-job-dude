import Link from "next/link";
import { cancelInvitation, revokeViewer } from "@/app/actions";
import { SignInButton, SignOutButton } from "@/components/auth-buttons";
import { InviteForm } from "@/components/invite-form";
import { Button, buttonVariants } from "@/components/ui/button";
import { application, currentPerson } from "@/lib/server";

// The Owner's list of who can see the search: invite, cancel unused links, revoke Viewers.
export default async function ViewersPage() {
  const person = await currentPerson();

  if (!person) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-6 p-6">
        <h1 className="text-2xl font-semibold">Loopboard</h1>
        <SignInButton callbackURL="/viewers" />
      </main>
    );
  }

  const view = await application.viewersView(person);

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-4 sm:p-6">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-lg font-semibold">{view.access === "none" ? "No access" : "Viewers"}</h1>
        <div className="flex items-center gap-2">
          <Link href="/" className={buttonVariants({ variant: "ghost", size: "sm" })}>
            Back
          </Link>
          <SignOutButton />
        </div>
      </header>
      {view.access === "none" ? (
        <p className="text-muted-foreground">This account doesn&apos;t have access.</p>
      ) : (
        <>
          <section aria-labelledby="invite-heading" className="flex flex-col gap-3">
            <h2 id="invite-heading" className="font-medium">
              Invite a Viewer
            </h2>
            <InviteForm />
          </section>
          <section aria-labelledby="pending-heading" className="flex flex-col gap-3">
            <h2 id="pending-heading" className="font-medium">
              Pending Invitations
            </h2>
            {view.pendingInvitations.length === 0 ? (
              <p className="text-sm text-muted-foreground">None.</p>
            ) : (
              <ul aria-labelledby="pending-heading" className="flex flex-col gap-2">
                {view.pendingInvitations.map((i) => (
                  <li key={i.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{i.email}</p>
                      <p className="text-sm text-muted-foreground">
                        {/* UTC until the per-person time zone resolver lands. */}
                        Expires {i.expiresAt.toISOString().slice(0, 10)} (UTC)
                      </p>
                    </div>
                    <form action={cancelInvitation.bind(null, i.id)}>
                      <Button type="submit" variant="outline" size="sm" aria-label={`Cancel Invitation for ${i.email}`}>
                        Cancel
                      </Button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section aria-labelledby="viewers-heading" className="flex flex-col gap-3">
            <h2 id="viewers-heading" className="font-medium">
              Current Viewers
            </h2>
            {view.viewers.length === 0 ? (
              <p className="text-sm text-muted-foreground">None.</p>
            ) : (
              <ul aria-labelledby="viewers-heading" className="flex flex-col gap-2">
                {view.viewers.map((v) => (
                  <li key={v.userId} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{v.name}</p>
                      <p className="truncate text-sm text-muted-foreground">{v.email}</p>
                    </div>
                    <form action={revokeViewer.bind(null, v.userId)}>
                      <Button type="submit" variant="destructive" size="sm" aria-label={`Revoke ${v.name}`}>
                        Revoke
                      </Button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </main>
  );
}
