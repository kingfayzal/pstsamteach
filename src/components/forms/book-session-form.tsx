"use client";

import { useActionState } from "react";
import { FormMessage, TextField, valueFrom } from "@/components/ui/fields";
import { SubmitButton } from "@/components/ui/submit-button";
import type { FormState } from "@/lib/validation/form";
import { type SlotGroup, SlotPicker } from "./slot-picker";

type Props = { action: (state: FormState, form: FormData) => Promise<FormState>; slots: SlotGroup[]; firstName: string };

export function BookSessionForm({ action, slots, firstName }: Props) {
  const [state, formAction] = useActionState(action, undefined);
  return (
    <form action={formAction} className="space-y-8">
      <FormMessage state={state} />
      <fieldset className="min-w-0 space-y-3">
        <legend className="text-base font-bold text-ink">Choose a time</legend>
        <SlotPicker groups={slots} selected={valueFrom(state, "slotStart")} error={state?.errors?.slotStart?.[0]} />
      </fieldset>
      <TextField name="agenda" label={`What would you like to work on with ${firstName}? (optional)`} state={state} />
      {slots.length ? <SubmitButton pendingLabel="Booking…">Book this session</SubmitButton> : null}
    </form>
  );
}
