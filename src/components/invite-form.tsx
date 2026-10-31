"use client";

import { useActionState, useState } from "react";
import { invite, type InviteState } from "@/app/actions";
import { Button } from "@/components/ui/button";

const field = "h-9 w-full min-w-0 rounded-lg border bg-background px-3 text-base sm:text-sm";

// Enter a Viewer's email, get back the Invitation link to send them yourself.
export function InviteForm() {
  const [state, action, pending] = useActionState<InviteState, FormData>(invite, { status: "idle" });
  const [copied, setCopied] = useState(false);

  return (
    <div className="flex flex-col gap-3">
      <form action={action} className="flex flex-col gap-2 sm:flex-row" onSubmit={() => setCopied(false)}>
        <label htmlFor="invite-email" className="sr-only">
          Viewer&apos;s email
        </label>
        <input
          id="invite-email"
          name="email"
          type="email"
          required
          autoComplete="off"
          placeholder="Viewer's email"
          className={field}
        />
        <Button type="submit" disabled={pending}>
          Create Invitation
        </Button>
      </form>
      {state.status === "error" && (
        <p role="alert" className="text-sm text-destructive">
          {state.message}
        </p>
      )}
      {state.status === "created" && (
        <div className="flex flex-col gap-2 rounded-lg border p-3">
          <label htmlFor="invite-link" className="text-sm">
            Invitation link for {state.email}. Send it yourself: it works once, for 7 days, and only
            for that Google account. It won&apos;t be shown again.
          </label>
          <div className="flex gap-2">
            <input id="invite-link" readOnly value={state.link} className={field} onFocus={(e) => e.target.select()} />
            <Button
              type="button"
              variant="outline"
              onClick={async () => {
                await navigator.clipboard.writeText(state.link);
                setCopied(true);
              }}
            >
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
