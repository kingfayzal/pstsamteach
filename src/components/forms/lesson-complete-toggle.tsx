"use client";

import { useActionState } from "react";
import { FormMessage } from "@/components/ui/fields";
import { Tick } from "@/components/ui/marks";
import { SubmitButton } from "@/components/ui/submit-button";
import type { FormState } from "@/lib/validation/form";

type Props = {
  action: (state: FormState, form: FormData) => Promise<FormState>;
  isComplete: boolean;
};

export function LessonCompleteToggle({ action, isComplete }: Props) {
  const [state, formAction] = useActionState(action, undefined);
  return (
    <form action={formAction} className="flex flex-col items-start gap-3">
      <input type="hidden" name="complete" value={isComplete ? "false" : "true"} />
      {isComplete ? (
        <div className="flex flex-wrap items-center gap-4">
          <p className="flex items-center gap-2 text-lg font-bold text-tick-text">
            <Tick className="h-6 w-7" /> You&rsquo;ve done this lesson
          </p>
          <SubmitButton variant="quiet" pendingLabel="Updating…">
            Mark as not done
          </SubmitButton>
        </div>
      ) : (
        <SubmitButton pendingLabel="Saving…">Mark lesson as done</SubmitButton>
      )}
      {state?.ok === false ? <FormMessage state={state} /> : null}
    </form>
  );
}
