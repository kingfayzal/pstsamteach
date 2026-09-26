import { z } from "zod";

export type FieldErrors = Partial<Record<string, string[]>>;

/** Shape every form action returns to `useActionState`. */
export type FormState =
  | {
      ok?: boolean;
      message?: string;
      errors?: FieldErrors;
    }
  | undefined;

export function fieldErrors(error: z.ZodError): FieldErrors {
  return z.flattenError(error).fieldErrors as FieldErrors;
}

/**
 * Turn FormData into a plain object for Zod. Keys listed in `arrayKeys`
 * keep every value; other keys keep the last one. Files are ignored.
 */
export function formDataToObject(form: FormData, arrayKeys: readonly string[] = []): Record<string, string | string[]> {
  const entries: Array<[string, string | string[]]> = [];
  const seen = new Set<string>();
  for (const key of form.keys()) {
    if (key.startsWith("$ACTION") || seen.has(key)) continue;
    seen.add(key);
    const values = form.getAll(key).filter((v): v is string => typeof v === "string");
    entries.push([key, arrayKeys.includes(key) ? values : (values.at(-1) ?? "")]);
  }
  return Object.fromEntries(entries);
}

/** Empty strings from optional form fields become null. */
export const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Keep this under ${max} characters.`)
    .optional()
    .transform((value) => (value ? value : null));

export const idSchema = z.string().trim().min(1, "Missing identifier.").max(64);
