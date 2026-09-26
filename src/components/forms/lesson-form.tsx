"use client";

import { useActionState } from "react";
import { FormMessage, TextAreaField, TextField } from "@/components/ui/fields";
import { SubmitButton } from "@/components/ui/submit-button";
import type { FormState } from "@/lib/validation/form";
import { MarkdownHelp } from "./markdown-help";

type Props = {
  action: (state: FormState, form: FormData) => Promise<FormState>;
  lesson?: { title: string; body: string; videoUrl: string | null; durationMinutes: number };
  submitLabel: string;
};

export function LessonForm({ action, lesson, submitLabel }: Props) {
  const [state, formAction] = useActionState(action, undefined);
  return (
    <form action={formAction} className="space-y-6">
      <TextField name="title" label="Lesson title" defaultValue={lesson?.title} required state={state} />
      <div className="grid gap-6 sm:grid-cols-[10rem_1fr]">
        <TextField
          name="durationMinutes"
          type="number"
          inputMode="numeric"
          min={1}
          max={600}
          label="Minutes"
          defaultValue={lesson?.durationMinutes ?? 10}
          required
          state={state}
        />
        <TextField
          name="videoUrl"
          type="url"
          label="Video link (optional)"
          hint="A YouTube or Vimeo link. It appears above the lesson text."
          defaultValue={lesson?.videoUrl}
          placeholder="https://www.youtube.com/watch?v=…"
          state={state}
        />
      </div>
      <TextAreaField
        name="body"
        label="Lesson content"
        hint="Write in plain text. Use the formatting help for headings, lists and tables."
        rows={18}
        defaultValue={lesson?.body}
        required
        state={state}
      />
      <MarkdownHelp />
      <FormMessage state={state} />
      <SubmitButton pendingLabel="Saving…">{submitLabel}</SubmitButton>
    </form>
  );
}
