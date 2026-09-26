"use client";

import { useActionState } from "react";
import { FormMessage, SelectField, TextAreaField, TextField, valueFrom } from "@/components/ui/fields";
import { SubmitButton } from "@/components/ui/submit-button";
import { toDateTimeLocal } from "@/lib/format";
import type { FormState } from "@/lib/validation/form";

type Props = {
  action: (state: FormState, form: FormData) => Promise<FormState>;
  assessment?: { title: string; instructions: string; kind: "QUIZ" | "ASSIGNMENT"; passPercent: number; maxPoints: number; dueAt: Date | null };
  defaultKind?: "QUIZ" | "ASSIGNMENT";
  submitLabel: string;
};

export function AssessmentForm({ action, assessment, defaultKind = "QUIZ", submitLabel }: Props) {
  const [state, formAction] = useActionState(action, undefined);
  const kind = valueFrom(state, "kind", assessment?.kind ?? defaultKind);
  return (
    <form action={formAction} className="max-w-2xl space-y-6">
      <div className="grid gap-6 sm:grid-cols-[1fr_12rem]">
        <TextField name="title" label="Title" defaultValue={assessment?.title} required state={state} />
        <SelectField
          name="kind"
          label="Type"
          options={[
            { value: "QUIZ", label: "Quiz (auto-marked)" },
            { value: "ASSIGNMENT", label: "Assignment (you mark it)" },
          ]}
          defaultValue={kind}
          state={state}
        />
      </div>
      <TextAreaField
        name="instructions"
        label="Instructions for students"
        hint="For an assignment, this is the task itself. Formatting works the same as lessons."
        rows={7}
        defaultValue={assessment?.instructions}
        required
        state={state}
      />
      <div className="grid gap-6 sm:grid-cols-3">
        <TextField name="passPercent" type="number" inputMode="numeric" min={0} max={100} label="Pass mark (%)" defaultValue={assessment?.passPercent ?? 60} state={state} />
        <TextField
          name="maxPoints"
          type="number"
          inputMode="numeric"
          min={1}
          max={1000}
          label="Marked out of"
          hint="Assignments only. Quizzes score one point per question."
          defaultValue={assessment?.maxPoints ?? 100}
          state={state}
        />
        <TextField name="dueAt" type="datetime-local" label="Due (optional)" defaultValue={toDateTimeLocal(assessment?.dueAt)} state={state} />
      </div>
      <FormMessage state={state} />
      <SubmitButton pendingLabel="Saving…">{submitLabel}</SubmitButton>
    </form>
  );
}
