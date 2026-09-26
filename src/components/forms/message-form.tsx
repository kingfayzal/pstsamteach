"use client";

import { useActionState } from "react";
import { FormMessage } from "@/components/ui/fields";
import { SubmitButton } from "@/components/ui/submit-button";
import type { FormState } from "@/lib/validation/form";

export function MessageForm({ action, otherName }: { action: (state: FormState, form: FormData) => Promise<FormState>; otherName: string }) {
  const [state, formAction] = useActionState(action, undefined);
  return (
    <form action={formAction} className="space-y-2">
      <label htmlFor="message-body" className="sr-only">
        Message {otherName}
      </label>
      <textarea
        id="message-body"
        name="body"
        rows={3}
        maxLength={2000}
        placeholder={`Write to ${otherName}…`}
        defaultValue={typeof state?.values?.body === "string" ? state.values.body : ""}
        className="block w-full rounded-control border border-rule bg-sheet px-3 py-2.5 text-base text-ink placeholder:text-muted/70"
      />
      <div className="flex items-center justify-between gap-3">
        <FormMessage state={state} className="text-sm" />
        <SubmitButton size="sm" pendingLabel="Sending…" className="ml-auto">
          Send message
        </SubmitButton>
      </div>
    </form>
  );
}
