"use client";

import { useActionState } from "react";
import { FormMessage } from "@/components/ui/fields";
import { SubmitButton } from "@/components/ui/submit-button";
import type { FormState } from "@/lib/validation/form";

/** Deliberately has no notion of which answer is correct: that never reaches the browser. */
export type QuizQuestionView = { id: string; prompt: string; options: { id: string; label: string }[] };

type Props = {
  questions: QuizQuestionView[];
  action: (state: FormState, form: FormData) => Promise<FormState>;
};

export function QuizForm({ questions, action }: Props) {
  const [state, formAction] = useActionState(action, undefined);
  return (
    <form action={formAction} className="space-y-10">
      <FormMessage state={state} />
      <ol className="space-y-10">
        {questions.map((question, index) => (
          <li key={question.id}>
            <fieldset>
              <legend className="flex gap-3 text-xl font-bold text-ink">
                <span className="figures text-muted">{index + 1}.</span>
                <span>{question.prompt}</span>
              </legend>
              <div className="mt-4 space-y-2 pl-7">
                {question.options.map((option) => (
                  <label
                    key={option.id}
                    className="flex cursor-pointer items-center gap-3 rounded-control border border-rule bg-sheet px-4 py-3 text-lg text-ink has-checked:border-ink has-checked:shadow-[inset_3px_0_0_var(--color-ink)]"
                  >
                    <input
                      type="radio"
                      name={`q:${question.id}`}
                      value={option.id}
                      defaultChecked={state?.values?.[`q:${question.id}`] === option.id}
                      className="h-5 w-5 accent-ink"
                    />
                    <span className="figures">{option.label}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          </li>
        ))}
      </ol>
      <div className="border-t border-rule pt-6">
        <SubmitButton pendingLabel="Marking…">Submit answers</SubmitButton>
      </div>
    </form>
  );
}
