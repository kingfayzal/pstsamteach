"use client";

import { useActionState } from "react";
import { FormMessage, TextAreaField } from "@/components/ui/fields";
import { SubmitButton } from "@/components/ui/submit-button";
import type { FormState } from "@/lib/validation/form";

type Action = (state: FormState, form: FormData) => Promise<FormState>;

/** Accept a student's request, or decline it with an optional note. */
export function RespondForm({ accept, decline, studentFirstName }: { accept: Action; decline: Action; studentFirstName: string }) {
  const [acceptState, acceptAction] = useActionState(accept, undefined);
  const [declineState, declineAction] = useActionState(decline, undefined);
  return (
    <div className="space-y-4">
      <form action={acceptAction}>
        <SubmitButton pendingLabel="Accepting…">Accept {studentFirstName}</SubmitButton>
        <FormMessage state={acceptState} className="mt-2" />
      </form>
      <details>
        <summary className="cursor-pointer text-base font-bold text-ink-soft underline decoration-rule underline-offset-4">Decline</summary>
        <form action={declineAction} className="mt-3 max-w-xl space-y-3">
          <TextAreaField name="note" label="A note for the student (optional)" hint="For example, suggest another teacher or a better time to ask." rows={3} state={declineState} />
          <SubmitButton variant="danger" pendingLabel="Declining…">
            Decline request
          </SubmitButton>
          <FormMessage state={declineState} />
        </form>
      </details>
    </div>
  );
}
