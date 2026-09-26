import "server-only";
import { headers } from "next/headers";
import { formDataToObject, type FormState } from "@/lib/validation/form";
import type { ServiceError } from "@/server/services/result";

/** Never echo secrets back to the browser. */
function echoValues(form: FormData, arrayKeys: readonly string[]): Record<string, string | string[]> {
  const values = formDataToObject(form, arrayKeys);
  return Object.fromEntries(Object.entries(values).filter(([key]) => !key.toLowerCase().includes("password")));
}

export function errorState(error: ServiceError, form?: FormData, arrayKeys: readonly string[] = []): FormState {
  return { ok: false, message: error.message, errors: error.errors, ...(form ? { values: echoValues(form, arrayKeys) } : {}) };
}

export function successState(message: string): FormState {
  return { ok: true, message };
}

/** Best-effort client IP for rate limiting. Trusts the first proxy hop. */
export async function clientIp(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || h.get("x-real-ip") || "local";
}

export function readString(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === "string" ? value : "";
}
