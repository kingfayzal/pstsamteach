"use client";

import { useActionState } from "react";
import { FormMessage, TextAreaField } from "@/components/ui/fields";
import { SubmitButton } from "@/components/ui/submit-button";
import type { FormState } from "@/lib/validation/form";

type Props = {
  action: (state: FormState, form: FormData) => Promise<FormState>;
  existing: string | null;
};

export function AssignmentForm({ action, existing }: Props) {
  const [state, formAction] = useActionState(action, undefined);
  return (
    <form action={formAction} className="space-y-5">
      <TextAreaField
        name="response"
        label={existing ? "Your answer" : "Write your answer"}
        hint="Plain text. Show your working where it helps."
        rows={12}
        defaultValue={existing}
        state={state}
      />
      <FormMessage state={state} />
      <SubmitButton pendingLabel="Handing in…">{existing ? "Update my answer" : "Hand in assignment"}</SubmitButton>
    </form>
  );
}
