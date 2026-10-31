"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

export function SignInButton({ callbackURL = "/" }: { callbackURL?: string }) {
  return (
    <Button onClick={() => authClient.signIn.social({ provider: "google", callbackURL })}>
      Sign in with Google
    </Button>
  );
}

export function SignOutButton() {
  const router = useRouter();
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() =>
        authClient.signOut({ fetchOptions: { onSuccess: () => router.refresh() } })
      }
    >
      Sign out
    </Button>
  );
}
