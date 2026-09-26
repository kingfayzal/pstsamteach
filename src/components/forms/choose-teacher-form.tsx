"use client";

import { useActionState } from "react";
import { FormMessage, SelectField, TextAreaField, TextField, valueFrom } from "@/components/ui/fields";
import { SubmitButton } from "@/components/ui/submit-button";
import type { FormState } from "@/lib/validation/form";
import { type SlotGroup, SlotPicker } from "./slot-picker";

type Props = {
  action: (state: FormState, form: FormData) => Promise<FormState>;
  firstName: string;
  topics: { id: string; label: string }[];
  slots: SlotGroup[];
  timeZone: string;
};

export function ChooseTeacherForm({ action, firstName, topics, slots, timeZone }: Props) {
  const [state, formAction] = useActionState(action, undefined);
  return (
    <form action={formAction} className="space-y-8">
      <FormMessage state={state} />
      <SelectField name="topicId" label="What do you want help with?" placeholder="Choose a topic (optional)" options={topics.map((t) => ({ value: t.id, label: t.label }))} state={state} />
      <TextAreaField
        name="goals"
        label={`Introduce yourself to ${firstName}`}
        hint="Your level, what you're working towards, and anything that's been hard so far. Teachers read this before they accept."
        rows={6}
        required
        state={state}
      />
      <fieldset className="min-w-0 space-y-3">
        <legend className="text-base font-bold text-ink">Pick a time for your first session</legend>
        <p className="text-sm text-muted">
          Optional. {firstName} confirms it when they accept. Times are in your time zone ({timeZone.replace(/_/g, " ")}).
        </p>
        <SlotPicker groups={slots} optional selected={valueFrom(state, "slotStart")} error={state?.errors?.slotStart?.[0]} />
      </fieldset>
      <TextField name="agenda" label="Anything you'd like to cover first? (optional)" state={state} />
      <SubmitButton pendingLabel="Sending…">Send request to {firstName}</SubmitButton>
    </form>
  );
}
