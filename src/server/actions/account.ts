"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { CHECK_EMAIL_PATH } from "@/lib/routes";
import { formDataToObject, type FormState } from "@/lib/validation/form";
import { confirmationEmailLimiter } from "@/server/auth/rate-limit";
import { endOtherSessions, requireUser } from "@/server/auth/session";
import { sendQueuedEmails } from "@/server/email";
import { changePassword, setTimeZone, updateProfile } from "@/server/services/accounts";
import { changeUnconfirmedEmail, resendConfirmationEmail } from "@/server/services/email-confirmation";
import { errorState, successState } from "./helpers";

export async function updateProfileAction(_prev: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const result = await updateProfile(user, formDataToObject(form));
  if (!result.ok) return errorState(result, form);
  revalidatePath("/", "layout");
  return successState("Profile saved.");
}

export async function changePasswordAction(_prev: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const result = await changePassword(user, formDataToObject(form));
  if (!result.ok) return errorState(result, form);
  sendQueuedEmails();
  await endOtherSessions(user.id);
  return successState("Password changed. Other devices have been signed out.");
}

function tooManyLinks(retryAfterMs: number): FormState {
  const minutes = Math.max(1, Math.ceil(retryAfterMs / 60000));
  return { ok: false, message: `We've sent a few links already. Check your spam folder, or try again in ${minutes} minute${minutes === 1 ? "" : "s"}.` };
}

/** Works before the address is confirmed: it's how people get there. */
export async function resendConfirmationAction(_prev: FormState): Promise<FormState> {
  const user = await requireUser({ allowUnconfirmed: true });
  const limit = await confirmationEmailLimiter.hit(`user:${user.id}`);
  if (!limit.allowed) return tooManyLinks(limit.retryAfterMs);
  const result = await resendConfirmationEmail(user);
  if (!result.ok) return errorState(result);
  sendQueuedEmails();
  return successState(`Sent. Check ${result.data.email} for a new link (it can take a minute, and may land in spam).`);
}

export async function setTimeZoneAction(_prev: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const result = await setTimeZone(user, formDataToObject(form));
  if (!result.ok) return errorState(result, form);
  revalidatePath("/", "layout");
  return successState("Time zone saved. Times across the site now use it.");
}

/** Fix a mistyped address from the confirm page. Shares the "new link" budget, since it sends one. */
export async function changeUnconfirmedEmailAction(_prev: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser({ allowUnconfirmed: true });
  const limit = await confirmationEmailLimiter.hit(`user:${user.id}`);
  if (!limit.allowed) return tooManyLinks(limit.retryAfterMs);
  const result = await changeUnconfirmedEmail(user, formDataToObject(form));
  if (!result.ok) return errorState(result, form);
  sendQueuedEmails();
  redirect(`${CHECK_EMAIL_PATH}?notice=email-changed`);
}
