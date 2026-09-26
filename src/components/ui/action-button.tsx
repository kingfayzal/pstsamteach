"use client";

import { useActionState } from "react";
import type { FormState } from "@/lib/validation/form";
import type { ButtonSize, ButtonVariant } from "./button";
import { FormMessage } from "./fields";
import { SubmitButton } from "./submit-button";

type Props = {
  action: (state: FormState, form: FormData) => Promise<FormState>;
  label: string;
  pendingLabel?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Ask before running. Use for anything that deletes or can't be undone. */
  confirm?: string;
  hidden?: Record<string, string>;
  className?: string;
};

/** A one-button form for a bound server action, with its result shown inline. */
export function ActionButton({ action, label, pendingLabel, variant = "secondary", size = "sm", confirm, hidden, className = "" }: Props) {
  const [state, formAction] = useActionState(action, undefined);
  return (
    <form
      action={formAction}
      className={`inline-flex flex-col items-start gap-2 ${className}`}
      onSubmit={(event) => {
        if (confirm && !window.confirm(confirm)) event.preventDefault();
      }}
    >
      {hidden ? Object.entries(hidden).map(([name, value]) => <input key={name} type="hidden" name={name} value={value} />) : null}
      <SubmitButton variant={variant} size={size} pendingLabel={pendingLabel}>
        {label}
      </SubmitButton>
      <FormMessage state={state} className="text-sm" />
    </form>
  );
}
