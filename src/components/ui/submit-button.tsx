"use client";

import { useFormStatus } from "react-dom";
import { Button, type ButtonSize, type ButtonVariant } from "./button";

type Props = {
  children: React.ReactNode;
  pendingLabel?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  name?: string;
  value?: string;
};

export function SubmitButton({ children, pendingLabel, variant = "primary", size = "md", className, name, value }: Props) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} size={size} className={className} disabled={pending} aria-disabled={pending} name={name} value={value}>
      {pending && pendingLabel ? pendingLabel : children}
    </Button>
  );
}
