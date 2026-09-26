"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { FormMessage, TextAreaField, TextField } from "@/components/ui/fields";
import { SubmitButton } from "@/components/ui/submit-button";
import type { FormState } from "@/lib/validation/form";

const MIN_SLOTS = 4;
const MAX_SLOTS = 6;

type Props = {
  action: (state: FormState, form: FormData) => Promise<FormState>;
  question?: { prompt: string; explanation: string | null; options: { label: string; isCorrect: boolean }[] };
  submitLabel: string;
  idPrefix: string;
};

function initialOptions(state: FormState, question: Props["question"]): string[] {
  const echoed = state?.values?.options;
  if (Array.isArray(echoed)) return echoed;
  return question?.options.map((o) => o.label) ?? [];
}

/** Multiple-choice question editor: 2 to 6 options, exactly one marked correct. */
export function QuestionForm({ action, question, submitLabel, idPrefix }: Props) {
  const [state, formAction] = useActionState(action, undefined);
  const options = initialOptions(state, question);
  const [slots, setSlots] = useState(Math.min(MAX_SLOTS, Math.max(MIN_SLOTS, options.length)));
  const echoedCorrect = state?.values?.correctIndex;
  const correct = typeof echoedCorrect === "string" ? Number(echoedCorrect) : Math.max(0, question?.options.findIndex((o) => o.isCorrect) ?? 0);
  const optionErrors = state?.errors?.options ?? state?.errors?.correctIndex;

  return (
    <form action={formAction} className="space-y-5">
      <TextAreaField name="prompt" id={`${idPrefix}-prompt`} label="Question" rows={2} defaultValue={question?.prompt} required state={state} />
      <fieldset className="space-y-2">
        <legend className="mb-1 text-base font-bold text-ink">Answer options</legend>
        <p className="mb-2 text-sm text-muted">Select the correct answer. Leave spare boxes empty.</p>
        {Array.from({ length: slots }, (_, index) => (
          <div key={index} className="flex items-center gap-3">
            <input
              type="radio"
              name="correctIndex"
              value={index}
              defaultChecked={index === correct}
              aria-label={`Option ${index + 1} is correct`}
              className="h-5 w-5 shrink-0 accent-tick"
            />
            <label htmlFor={`${idPrefix}-option-${index}`} className="sr-only">
              Option {index + 1}
            </label>
            <input
              id={`${idPrefix}-option-${index}`}
              name="options"
              defaultValue={options[index] ?? ""}
              className="block w-full rounded-control border border-rule bg-sheet px-3 py-2 text-base text-ink"
            />
          </div>
        ))}
        {optionErrors?.length ? <p className="text-sm font-bold text-danger">{optionErrors[0]}</p> : null}
        {slots < MAX_SLOTS ? (
          <Button variant="quiet" className="text-sm" onClick={() => setSlots((n) => Math.min(MAX_SLOTS, n + 1))}>
            Add another option
          </Button>
        ) : null}
      </fieldset>
      <TextField name="explanation" id={`${idPrefix}-explanation`} label="Explanation (optional)" hint="Shown to students after they submit." defaultValue={question?.explanation} state={state} />
      <FormMessage state={state} />
      <SubmitButton size="sm" pendingLabel="Saving…">
        {submitLabel}
      </SubmitButton>
    </form>
  );
}
