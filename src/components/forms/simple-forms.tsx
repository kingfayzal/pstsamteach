"use client";

import { useActionState } from "react";
import { FormMessage, SelectField, TextAreaField, TextField } from "@/components/ui/fields";
import { SubmitButton } from "@/components/ui/submit-button";
import type { FormState } from "@/lib/validation/form";

type Action = (state: FormState, form: FormData) => Promise<FormState>;

export function GradeForm({ action, maxScore, existing }: { action: Action; maxScore: number; existing?: { score: number | null; feedback: string | null } }) {
  const [state, formAction] = useActionState(action, undefined);
  return (
    <form action={formAction} className="space-y-5">
      <div className="max-w-[14rem]">
        <TextField
          name="score"
          type="number"
          inputMode="numeric"
          min={0}
          max={maxScore}
          label={`Score out of ${maxScore}`}
          defaultValue={existing?.score ?? ""}
          required
          state={state}
        />
      </div>
      <TextAreaField
        name="feedback"
        label="Feedback for the student"
        hint="What they did well, and one thing to work on. They'll see this next to their score."
        rows={6}
        defaultValue={existing?.feedback}
        state={state}
      />
      <FormMessage state={state} />
      <SubmitButton pendingLabel="Saving mark…">{existing?.score !== null && existing?.score !== undefined ? "Update mark" : "Save mark"}</SubmitButton>
    </form>
  );
}

export function AnnouncementForm({ action, withAudience = false }: { action: Action; withAudience?: boolean }) {
  const [state, formAction] = useActionState(action, undefined);
  return (
    <form action={formAction} className="max-w-2xl space-y-5">
      <TextField name="title" label="Title" required state={state} />
      <TextAreaField name="body" label="Message" rows={5} required state={state} />
      {withAudience ? (
        <SelectField
          name="audience"
          label="Who should see this"
          options={[
            { value: "EVERYONE", label: "Everyone" },
            { value: "STUDENTS", label: "Students only" },
            { value: "TEACHERS", label: "Teachers only" },
          ]}
          defaultValue="EVERYONE"
          state={state}
        />
      ) : null}
      <FormMessage state={state} />
      <SubmitButton pendingLabel="Posting…">Post announcement</SubmitButton>
    </form>
  );
}

export function ReviewNoteForm({ action }: { action: Action }) {
  const [state, formAction] = useActionState(action, undefined);
  return (
    <form action={formAction} className="space-y-4">
      <TextAreaField
        name="note"
        label="Notes for the teacher"
        hint="Say exactly what needs to change before you'll approve it."
        rows={4}
        required
        state={state}
      />
      <FormMessage state={state} />
      <SubmitButton variant="danger" pendingLabel="Sending…">
        Send back with notes
      </SubmitButton>
    </form>
  );
}
