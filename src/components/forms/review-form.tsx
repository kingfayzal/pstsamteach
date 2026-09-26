"use client";

import { useActionState } from "react";
import { FormMessage, TextAreaField, valueFrom } from "@/components/ui/fields";
import { SubmitButton } from "@/components/ui/submit-button";
import type { FormState } from "@/lib/validation/form";

type Props = {
  action: (state: FormState, form: FormData) => Promise<FormState>;
  existing: { rating: number; body: string } | null;
  teacherFirstName: string;
};

export function ReviewForm({ action, existing, teacherFirstName }: Props) {
  const [state, formAction] = useActionState(action, undefined);
  const current = valueFrom(state, "rating", existing?.rating ?? "");
  return (
    <form action={formAction} className="max-w-2xl space-y-5">
      <fieldset>
        <legend className="mb-2 text-base font-bold text-ink">Your rating</legend>
        <div className="flex flex-wrap gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <label
              key={n}
              className="flex cursor-pointer items-center gap-2 rounded-control border border-rule bg-sheet px-3 py-2 text-base text-ink has-checked:border-ink has-checked:bg-ink has-checked:text-paper has-focus-visible:outline-3 has-focus-visible:outline-focus"
            >
              <input type="radio" name="rating" value={n} defaultChecked={current === String(n)} className="sr-only" />
              {n} star{n === 1 ? "" : "s"}
            </label>
          ))}
        </div>
        {state?.errors?.rating?.length ? <p className="mt-1 text-sm font-bold text-danger">{state.errors.rating[0]}</p> : null}
      </fieldset>
      <TextAreaField
        name="body"
        label={`What's it like learning with ${teacherFirstName}?`}
        hint="Other students read this when choosing a teacher. Be specific and fair."
        rows={4}
        defaultValue={existing?.body}
        state={state}
      />
      <FormMessage state={state} />
      <SubmitButton pendingLabel="Saving…">{existing ? "Update review" : "Post review"}</SubmitButton>
    </form>
  );
}
