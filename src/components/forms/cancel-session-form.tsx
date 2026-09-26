"use client";

import { useActionState } from "react";
import { FormMessage } from "@/components/ui/fields";
import { SubmitButton } from "@/components/ui/submit-button";
import type { FormState } from "@/lib/validation/form";

export function CancelSessionForm({ action }: { action: (state: FormState, form: FormData) => Promise<FormState> }) {
  const [state, formAction] = useActionState(action, undefined);
  return (
    <details className="text-sm">
      <summary className="cursor-pointer font-bold text-ink-soft underline decoration-rule underline-offset-4">Cancel</summary>
      <form action={formAction} className="mt-2 flex w-64 flex-col gap-2">
        <label className="text-sm text-ink-soft">
          Reason (optional)
          <input name="reason" maxLength={300} className="mt-1 block w-full rounded-control border border-rule bg-sheet px-2 py-1.5 text-sm text-ink" />
        </label>
        <SubmitButton variant="danger" size="sm" pendingLabel="Cancelling…">
          Cancel this session
        </SubmitButton>
        <FormMessage state={state} className="text-sm" />
      </form>
    </details>
  );
}
