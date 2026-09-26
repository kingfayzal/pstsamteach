import type { ReactNode } from "react";
import type { FormState } from "@/lib/validation/form";

const CONTROL =
  "block w-full rounded-control border border-rule bg-sheet px-3 py-2.5 text-base text-ink placeholder:text-muted/70 aria-invalid:border-danger disabled:bg-rule-soft";

type BaseProps = {
  name: string;
  /** DOM id, when the same field name appears more than once on a page. */
  id?: string;
  label: string;
  hint?: ReactNode;
  state?: FormState;
  className?: string;
};

/** The echoed value if the last submission failed, otherwise the stored one. */
export function valueFrom(state: FormState, name: string, fallback: string | number | null | undefined = ""): string {
  const echoed = state?.values?.[name];
  if (typeof echoed === "string") return echoed;
  return fallback === null || fallback === undefined ? "" : String(fallback);
}

function FieldShell({ name, id = name, label, hint, state, className = "", children }: BaseProps & { children: ReactNode }) {
  const errors = state?.errors?.[name];
  return (
    <div className={`space-y-1.5 ${className}`}>
      <label htmlFor={id} className="block text-base font-bold text-ink">
        {label}
      </label>
      {hint ? (
        <p id={`${id}-hint`} className="text-sm text-muted">
          {hint}
        </p>
      ) : null}
      {children}
      {errors?.length ? (
        <p id={`${id}-error`} className="text-sm font-bold text-danger">
          {errors[0]}
        </p>
      ) : null}
    </div>
  );
}

function describedBy(name: string, id: string, hint: unknown, state?: FormState): string | undefined {
  const ids = [hint ? `${id}-hint` : null, state?.errors?.[name]?.length ? `${id}-error` : null].filter(Boolean);
  return ids.length ? ids.join(" ") : undefined;
}

type TextFieldProps = BaseProps & {
  type?: "text" | "email" | "password" | "number" | "url" | "datetime-local";
  defaultValue?: string | number | null;
  autoComplete?: string;
  required?: boolean;
  placeholder?: string;
  min?: number;
  max?: number;
  inputMode?: "numeric" | "text" | "email" | "url";
};

export function TextField({ type = "text", defaultValue, autoComplete, required, placeholder, min, max, inputMode, ...base }: TextFieldProps) {
  const invalid = Boolean(base.state?.errors?.[base.name]?.length);
  return (
    <FieldShell {...base}>
      <input
        id={base.id ?? base.name}
        name={base.name}
        type={type}
        defaultValue={type === "password" ? undefined : valueFrom(base.state, base.name, defaultValue)}
        autoComplete={autoComplete}
        required={required}
        placeholder={placeholder}
        min={min}
        max={max}
        inputMode={inputMode}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy(base.name, base.id ?? base.name, base.hint, base.state)}
        className={CONTROL}
      />
    </FieldShell>
  );
}

type TextAreaProps = BaseProps & { defaultValue?: string | null; rows?: number; required?: boolean; placeholder?: string };

export function TextAreaField({ defaultValue, rows = 5, required, placeholder, ...base }: TextAreaProps) {
  const invalid = Boolean(base.state?.errors?.[base.name]?.length);
  return (
    <FieldShell {...base}>
      <textarea
        id={base.id ?? base.name}
        name={base.name}
        rows={rows}
        defaultValue={valueFrom(base.state, base.name, defaultValue)}
        required={required}
        placeholder={placeholder}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy(base.name, base.id ?? base.name, base.hint, base.state)}
        className={`${CONTROL} leading-relaxed`}
      />
    </FieldShell>
  );
}

type SelectProps = BaseProps & {
  options: readonly { value: string; label: string }[];
  defaultValue?: string | null;
  placeholder?: string;
  required?: boolean;
};

export function SelectField({ options, defaultValue, placeholder, required, ...base }: SelectProps) {
  const invalid = Boolean(base.state?.errors?.[base.name]?.length);
  return (
    <FieldShell {...base}>
      <div className="relative">
        <select
          id={base.id ?? base.name}
          name={base.name}
          defaultValue={valueFrom(base.state, base.name, defaultValue)}
          required={required}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy(base.name, base.id ?? base.name, base.hint, base.state)}
          className={`${CONTROL} appearance-none pr-10`}
        >
          {placeholder ? <option value="">{placeholder}</option> : null}
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <svg aria-hidden="true" viewBox="0 0 12 8" className="pointer-events-none absolute top-1/2 right-3.5 h-2 w-3 -translate-y-1/2 text-ink" fill="none">
          <path d="M1 1l5 5 5-5" stroke="currentColor" strokeWidth="1.8" />
        </svg>
      </div>
    </FieldShell>
  );
}

/** Form-level result line. Errors interrupt; confirmations are announced politely. */
export function FormMessage({ state, className = "" }: { state: FormState; className?: string }) {
  if (!state?.message) return null;
  if (state.ok) {
    return (
      <p role="status" className={`flex items-start gap-2 text-base font-bold text-tick-text ${className}`}>
        <TickGlyph />
        {state.message}
      </p>
    );
  }
  return (
    <p role="alert" className={`rounded-control border border-danger/30 bg-danger-wash px-3 py-2 text-base font-bold text-danger ${className}`}>
      {state.message}
    </p>
  );
}

function TickGlyph() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="mt-0.5 h-5 w-5 shrink-0" fill="none">
      <path d="M4 13.5l5 5L20.5 5" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
