"use server";

import { redirect } from "next/navigation";
import { homePathFor, safeNextPath } from "@/lib/routes";
import { formDataToObject, type FormState } from "@/lib/validation/form";
import { loginLimiter, signupLimiter } from "@/server/auth/rate-limit";
import { endSession, startSession } from "@/server/auth/session";
import { getBrowserTimeZone } from "@/server/auth/viewer";
import { applyToTeach, authenticate, captureTimeZone, registerStudent } from "@/server/services/accounts";
import { clientIp, errorState, readString } from "./helpers";

function tooManyAttempts(retryAfterMs: number): FormState {
  const minutes = Math.max(1, Math.ceil(retryAfterMs / 60000));
  return { ok: false, message: `Too many attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.` };
}

export async function signupAction(_prev: FormState, form: FormData): Promise<FormState> {
  const limit = signupLimiter.hit(`signup:${await clientIp()}`);
  if (!limit.allowed) return tooManyAttempts(limit.retryAfterMs);

  const result = await registerStudent(formDataToObject(form));
  if (!result.ok) return errorState(result, form);
  await startSession(result.data.id);
  await captureTimeZone(result.data.id, await getBrowserTimeZone());
  redirect(safeNextPath(readString(form, "next")) ?? "/learn?notice=welcome");
}

export async function applyToTeachAction(_prev: FormState, form: FormData): Promise<FormState> {
  const limit = signupLimiter.hit(`signup:${await clientIp()}`);
  if (!limit.allowed) return tooManyAttempts(limit.retryAfterMs);

  const result = await applyToTeach(formDataToObject(form));
  if (!result.ok) return errorState(result, form);
  await startSession(result.data.id);
  await captureTimeZone(result.data.id, await getBrowserTimeZone());
  redirect("/teach/pending");
}

export async function loginAction(_prev: FormState, form: FormData): Promise<FormState> {
  const email = readString(form, "email").trim().toLowerCase();
  const key = `login:${await clientIp()}:${email}`;
  const limit = loginLimiter.hit(key);
  if (!limit.allowed) return tooManyAttempts(limit.retryAfterMs);

  const result = await authenticate(formDataToObject(form));
  if (!result.ok) return errorState(result, form);

  loginLimiter.reset(key);
  await startSession(result.data.id);
  await captureTimeZone(result.data.id, await getBrowserTimeZone());
  const next = safeNextPath(readString(form, "next"));
  redirect(next ?? homePathFor(result.data));
}

export async function logoutAction(): Promise<void> {
  await endSession();
  redirect("/");
}
