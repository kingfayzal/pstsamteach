"use client";

import { useActionState } from "react";
import { FormMessage, SelectField, TextAreaField, TextField } from "@/components/ui/fields";
import { SubmitButton } from "@/components/ui/submit-button";
import type { FormState } from "@/lib/validation/form";

type Action = (state: FormState, form: FormData) => Promise<FormState>;

export function RoleForm({ action, role }: { action: Action; role: string }) {
  const [state, formAction] = useActionState(action, undefined);
  return (
    <form
      action={formAction}
      className="space-y-3"
      onSubmit={(event) => {
        if (!window.confirm("Change this person's role? They'll be signed out and see a different area next time they log in.")) event.preventDefault();
      }}
    >
      <SelectField
        name="role"
        label="Role"
        options={[
          { value: "STUDENT", label: "Student" },
          { value: "TEACHER", label: "Teacher" },
          { value: "ADMIN", label: "Admin" },
        ]}
        defaultValue={role}
        state={state}
      />
      <FormMessage state={state} className="text-sm" />
      <SubmitButton variant="secondary" size="sm" pendingLabel="Changing…">
        Change role
      </SubmitButton>
    </form>
  );
}

type Subject = { name: string; tagline: string; description: string; color: string };

export function SubjectForm({ action, subject, idPrefix, submitLabel }: { action: Action; subject?: Subject; idPrefix: string; submitLabel: string }) {
  const [state, formAction] = useActionState(action, undefined);
  return (
    <form action={formAction} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_10rem]">
        <TextField name="name" id={`${idPrefix}-name`} label="Name" defaultValue={subject?.name} required state={state} />
        <TextField name="color" id={`${idPrefix}-color`} label="Colour (hex)" defaultValue={subject?.color ?? "#"} placeholder="#2356C2" required state={state} />
      </div>
      <TextField name="tagline" id={`${idPrefix}-tagline`} label="Tagline" defaultValue={subject?.tagline} required state={state} />
      <TextAreaField name="description" id={`${idPrefix}-description`} label="Description" rows={3} defaultValue={subject?.description} required state={state} />
      <FormMessage state={state} className="text-sm" />
      <SubmitButton size="sm" pendingLabel="Saving…">
        {submitLabel}
      </SubmitButton>
    </form>
  );
}
