"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import type { InterviewLoopRow } from "@/application";
import { loopEndings, type LoopEnding } from "@/application/loop-ending";
import { deleteInterviewLoop, saveInterviewLoop, setLoopEnding, type LoopFormState } from "@/app/actions";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";

// One row per Interview Loop: open loops first, ended ones dimmed below (the
// query orders them). Controls that change a loop show only for the Owner.
export function InterviewLoops({ loops, canChange }: { loops: InterviewLoopRow[]; canChange: boolean }) {
  return (
    <section aria-labelledby="interview-loops-heading" className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-4">
        <h2 id="interview-loops-heading" className="text-base font-semibold">
          Interview Loops
        </h2>
        {canChange && <LoopFormDialog trigger="New loop" />}
      </div>
      {loops.length === 0 ? (
        <p className="text-muted-foreground">Nothing here yet.</p>
      ) : (
        <ul aria-label="Interview Loops" className="flex flex-col gap-2">
          {loops.map((loop) => (
            <LoopRow key={loop.id} loop={loop} canChange={canChange} />
          ))}
        </ul>
      )}
    </section>
  );
}

function LoopRow({ loop, canChange }: { loop: InterviewLoopRow; canChange: boolean }) {
  const ended = loop.ending !== "open";
  return (
    <li className={`flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-start sm:justify-between ${ended ? "opacity-60" : ""}`}>
      <div className="flex min-w-0 flex-col gap-1">
        <p>
          <span className="font-medium">{loop.company}</span>
          <span className="text-muted-foreground"> · {loop.role}</span>
          {ended && <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-xs">Ended: {loop.ending}</span>}
        </p>
        <p className="text-sm text-muted-foreground">
          {[loop.location, loop.appliedOn && `Applied ${loop.appliedOn}`].filter(Boolean).join(" · ")}
        </p>
        {loop.people && <p className="text-sm whitespace-pre-line">People: {loop.people}</p>}
        {loop.jobLink && (
          <a href={loop.jobLink} target="_blank" rel="noreferrer" className="truncate text-sm text-primary underline-offset-4 hover:underline">
            Job link
          </a>
        )}
      </div>
      {canChange && (
        <div className="flex flex-wrap items-center gap-2">
          <EndingSelect loop={loop} />
          <LoopFormDialog trigger="Edit" loop={loop} />
          <DeleteLoopDialog loop={loop} />
        </div>
      )}
    </li>
  );
}

function EndingSelect({ loop }: { loop: InterviewLoopRow }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  return (
    <label className="flex items-center gap-1 text-sm">
      Ending
      <select
        aria-label={`Ending for ${loop.company}`}
        className="h-7 rounded-md border bg-background px-1"
        value={loop.ending}
        disabled={pending}
        onChange={(e) => {
          const ending = e.target.value as LoopEnding;
          startTransition(async () => setError((await setLoopEnding(loop.id, ending)).error));
        }}
      >
        {loopEndings.map((ending) => (
          <option key={ending} value={ending}>
            {ending}
          </option>
        ))}
      </select>
      {error && <span role="alert" className="text-destructive">{error}</span>}
    </label>
  );
}

const fields = [
  { name: "company", label: "Company", required: true },
  { name: "role", label: "Role", required: true },
  { name: "location", label: "Location" },
  { name: "jobLink", label: "Job link", type: "url" },
  { name: "appliedOn", label: "Applied date", type: "date" },
] as const;

function LoopFormDialog({ trigger, loop }: { trigger: string; loop?: InterviewLoopRow }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        variant={loop ? "outline" : "default"}
        size="sm"
        aria-label={loop ? `Edit ${loop.company}` : undefined}
        onClick={() => setOpen(true)}
      >
        {trigger}
      </Button>
      <DialogContent>
        <DialogTitle>{loop ? `Edit ${loop.company}` : "New Interview Loop"}</DialogTitle>
        {/* Remounted on each open, so the form starts from the loop's current facts. */}
        {open && <LoopForm loop={loop} onSaved={() => setOpen(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function LoopForm({ loop, onSaved }: { loop?: InterviewLoopRow; onSaved: () => void }) {
  const [state, action, pending] = useActionState<LoopFormState, FormData>(
    saveInterviewLoop.bind(null, loop?.id ?? null),
    {},
  );
  useEffect(() => {
    if (state.savedAt) onSaved();
  }, [state.savedAt, onSaved]);

  return (
    // noValidate: required-field errors come from the application layer, one source of truth.
    <form action={action} noValidate className="flex flex-col gap-3">
      {fields.map((f) => (
        <Field key={f.name} label={f.label} name={f.name} error={state.fieldErrors?.[f.name]}>
          {(props) => (
            <input
              {...props}
              type={"type" in f ? f.type : "text"}
              required={"required" in f}
              defaultValue={loop?.[f.name] ?? ""}
            />
          )}
        </Field>
      ))}
      <Field label="People" name="people" error={state.fieldErrors?.people}>
        {(props) => <textarea {...props} rows={3} defaultValue={loop?.people ?? ""} />}
      </Field>
      {state.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
      <div className="flex justify-end gap-2">
        <DialogClose render={<Button variant="outline" type="button" />}>Cancel</DialogClose>
        <Button type="submit" disabled={pending}>
          Save
        </Button>
      </div>
    </form>
  );
}

type FieldProps = { id: string; name: string; className: string; "aria-invalid"?: true; "aria-describedby"?: string };

function Field({
  label,
  name,
  error,
  children,
}: {
  label: string;
  name: string;
  error?: string;
  children: (props: FieldProps) => React.ReactNode;
}) {
  const id = `loop-${name}`;
  const errorId = `${id}-error`;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {children({
        id,
        name,
        className: "rounded-md border bg-background px-2 py-1.5 text-sm aria-invalid:border-destructive",
        ...(error && { "aria-invalid": true, "aria-describedby": errorId }),
      })}
      {error && (
        <p id={errorId} className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

function DeleteLoopDialog({ loop }: { loop: InterviewLoopRow }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <Button variant="destructive" size="sm" aria-label={`Delete ${loop.company}`} onClick={() => setOpen(true)}>
        Delete
      </Button>
      <AlertDialogContent>
        <AlertDialogTitle>Delete {loop.company}?</AlertDialogTitle>
        <AlertDialogDescription>
          This deletes the {loop.role} Interview Loop at {loop.company}. It can&apos;t be undone.
        </AlertDialogDescription>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2">
          <AlertDialogClose render={<Button variant="outline" />}>Cancel</AlertDialogClose>
          <Button
            variant="destructive"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await deleteInterviewLoop(loop.id);
                if (result.error) setError(result.error);
                else setOpen(false);
              })
            }
          >
            Delete loop
          </Button>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
