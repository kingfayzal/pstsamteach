import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary" | "danger" | "quiet";
export type ButtonSize = "md" | "sm";

const BASE =
  "inline-flex items-center justify-center gap-2 font-bold leading-none whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-55";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "rounded-control bg-ink text-paper hover:bg-ink-deep",
  secondary: "rounded-control border border-rule bg-sheet text-ink hover:border-ink-soft",
  danger: "rounded-control border border-danger/35 bg-sheet text-danger hover:bg-danger-wash",
  quiet: "text-ink underline decoration-rule decoration-2 underline-offset-4 hover:decoration-ink",
};

const SIZES: Record<ButtonSize, string> = {
  md: "px-4 py-3 text-base",
  sm: "px-3 py-2 text-sm",
};

export function buttonClasses(variant: ButtonVariant = "primary", size: ButtonSize = "md", extra = ""): string {
  const sizing = variant === "quiet" ? "text-base" : SIZES[size];
  return [BASE, VARIANTS[variant], sizing, extra].filter(Boolean).join(" ");
}

type ButtonProps = ComponentProps<"button"> & { variant?: ButtonVariant; size?: ButtonSize };

export function Button({ variant = "primary", size = "md", className = "", type = "button", ...props }: ButtonProps) {
  return <button type={type} className={buttonClasses(variant, size, className)} {...props} />;
}

type LinkButtonProps = { href: string; children: ReactNode; variant?: ButtonVariant; size?: ButtonSize; className?: string };

export function LinkButton({ href, children, variant = "primary", size = "md", className = "" }: LinkButtonProps) {
  return (
    <Link href={href} className={buttonClasses(variant, size, className)}>
      {children}
    </Link>
  );
}
