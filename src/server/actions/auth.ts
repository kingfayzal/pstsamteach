"use server";

import { redirect } from "next/navigation";
import { CHECK_EMAIL_PATH, homePathFor, safeNextPath } from "@/lib/routes";
import { formDataToObject, type FormState } from "@/lib/validation/form";
import { loginLimiter, passwordResetLimiter, signupLimiter } from "@/server/auth/rate-limit";
import { endSession, startSession } from "@/server/auth/session";
import { getBrowserTimeZone } from "@/server/auth/viewer";
import { sendQueuedEmails } from "@/server/email";
import { applyToTeach, authenticate, captureTimeZone, registerStudent } from "@/server/services/accounts";
import { requestPasswordReset, resetPassword } from "@/server/services/password-reset";
import { clientIp, errorState, readString, successState } from "./helpers";

function tooManyAttempts(retryAfterMs: number): FormState {
  const minutes = Math.max(1, Math.ceil(retryAfterMs / 60000));
  return { ok: false, message: `Too many attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.` };
}

export async function signupAction(_prev: FormState, form: FormData): Promise<FormState> {
  const limit = await signupLimiter.hit(`signup:${await clientIp()}`);
  if (!limit.allowed) return tooManyAttempts(limit.retryAfterMs);

  const result = await registerStudent(formDataToObject(form));
  if (!result.ok) return errorState(result, form);
  sendQueuedEmails();
  await startSession(result.data.id);
  await captureTimeZone(result.data.id, await getBrowserTimeZone());
  // Nothing works until the address is confirmed, so that's the next step.
  redirect(CHECK_EMAIL_PATH);
}

export async function applyToTeachAction(_prev: FormState, form: FormData): Promise<FormState> {
  const limit = await signupLimiter.hit(`signup:${await clientIp()}`);
  if (!limit.allowed) return tooManyAttempts(limit.retryAfterMs);

  const result = await applyToTeach(formDataToObject(form));
  if (!result.ok) return errorState(result, form);
  sendQueuedEmails();
  await startSession(result.data.id);
  await captureTimeZone(result.data.id, await getBrowserTimeZone());
  redirect(CHECK_EMAIL_PATH);
}

export async function loginAction(_prev: FormState, form: FormData): Promise<FormState> {
  const email = readString(form, "email").trim().toLowerCase();
  const key = `login:${await clientIp()}:${email}`;
  const limit = await loginLimiter.hit(key);
  if (!limit.allowed) return tooManyAttempts(limit.retryAfterMs);

  const result = await authenticate(formDataToObject(form));
  if (!result.ok) return errorState(result, form);

  await loginLimiter.reset(key);
  await startSession(result.data.id);
  await captureTimeZone(result.data.id, await getBrowserTimeZone());
  const next = safeNextPath(readString(form, "next"));
  redirect(next ?? homePathFor(result.data));
}

const RESET_LINK_SENT = "If there's an account for that address, we've sent it a link to choose a new password. It works for one hour.";

export async function requestPasswordResetAction(_prev: FormState, form: FormData): Promise<FormState> {
  const email = readString(form, "email").trim().toLowerCase();
  const [byIp, byAddress] = await Promise.all([
    passwordResetLimiter.hit(`ip:${await clientIp()}`),
    passwordResetLimiter.hit(`email:${email}`),
  ]);
  if (!byIp.allowed || !byAddress.allowed) return tooManyAttempts(Math.max(byIp.retryAfterMs, byAddress.retryAfterMs));

  const result = await requestPasswordReset(formDataToObject(form));
  if (!result.ok) return errorState(result, form);
  sendQueuedEmails();
  return successState(RESET_LINK_SENT);
}

export async function resetPasswordAction(_prev: FormState, form: FormData): Promise<FormState> {
  const result = await resetPassword(formDataToObject(form));
  if (!result.ok) return errorState(result, form);
  sendQueuedEmails();
  await startSession(result.data.id);
  redirect("/account?notice=password-reset");
}

export async function logoutAction(): Promise<void> {
  await endSession();
  redirect("/");
}
