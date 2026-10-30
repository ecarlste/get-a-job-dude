import { SignInButton, SignOutButton } from "@/components/auth-buttons";
import { application, currentPerson } from "@/lib/server";

export default async function MainPage() {
  const person = await currentPerson();

  if (!person) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-6 p-6">
        <h1 className="text-2xl font-semibold">Loopboard</h1>
        <SignInButton />
      </main>
    );
  }

  const view = await application.mainView(person);

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 p-4 sm:p-6">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-lg font-semibold">
          {view.access === "none" ? "No access" : `Hi, ${view.greetingName}`}
        </h1>
        <SignOutButton />
      </header>
      {view.access === "none" ? (
        <p className="text-muted-foreground">This account doesn&apos;t have access.</p>
      ) : (
        view.interviewLoops.length === 0 && (
          <p className="text-muted-foreground">Nothing here yet.</p>
        )
      )}
    </main>
  );
}
