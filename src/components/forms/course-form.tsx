"use client";

import { useActionState } from "react";
import { FormMessage, SelectField, TextAreaField, TextField } from "@/components/ui/fields";
import { SubmitButton } from "@/components/ui/submit-button";
import { COURSE_LEVELS, LEVEL_LABEL } from "@/lib/validation/course";
import type { FormState } from "@/lib/validation/form";
import { MarkdownHelp } from "./markdown-help";

type Props = {
  action: (state: FormState, form: FormData) => Promise<FormState>;
  subjects: { id: string; name: string }[];
  course?: { title: string; summary: string; description: string; subjectId: string; level: string };
  submitLabel: string;
  disabled?: boolean;
};

export function CourseForm({ action, subjects, course, submitLabel, disabled }: Props) {
  const [state, formAction] = useActionState(action, undefined);
  return (
    <form action={formAction} className="max-w-2xl space-y-6">
      <fieldset disabled={disabled} className="space-y-6 disabled:opacity-70">
        <TextField name="title" label="Course title" defaultValue={course?.title} required state={state} />
        <TextField
          name="summary"
          label="One-line summary"
          hint="Shown on the course cover in the catalog. 20 to 200 characters."
          defaultValue={course?.summary}
          required
          state={state}
        />
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <SelectField
            name="subjectId"
            label="Subject"
            placeholder="Choose a subject"
            options={subjects.map((s) => ({ value: s.id, label: s.name }))}
            defaultValue={course?.subjectId}
            required
            state={state}
          />
          <SelectField
            name="level"
            label="Level"
            options={COURSE_LEVELS.map((level) => ({ value: level, label: LEVEL_LABEL[level] }))}
            defaultValue={course?.level ?? "FOUNDATION"}
            state={state}
          />
        </div>
        <TextAreaField
          name="description"
          label="Description"
          hint="What students will learn and who the course is for. Needs at least 80 characters before you can submit for review."
          rows={10}
          defaultValue={course?.description}
          required
          state={state}
        />
        <MarkdownHelp />
      </fieldset>
      <FormMessage state={state} />
      {!disabled ? <SubmitButton pendingLabel="Saving…">{submitLabel}</SubmitButton> : null}
    </form>
  );
}
