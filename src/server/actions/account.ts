"use server";

import { revalidatePath } from "next/cache";
import { formDataToObject, type FormState } from "@/lib/validation/form";
import { confirmationEmailLimiter } from "@/server/auth/rate-limit";
import { endOtherSessions, requireUser } from "@/server/auth/session";
import { sendQueuedEmails } from "@/server/email";
import { changePassword, setTimeZone, updateProfile } from "@/server/services/accounts";
import { resendConfirmationEmail } from "@/server/services/email-confirmation";
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

export async function resendConfirmationAction(_prev: FormState): Promise<FormState> {
  const user = await requireUser();
  const limit = await confirmationEmailLimiter.hit(`user:${user.id}`);
  if (!limit.allowed) {
    const minutes = Math.max(1, Math.ceil(limit.retryAfterMs / 60000));
    return { ok: false, message: `We've sent a few links already. Check your spam folder, or try again in ${minutes} minute${minutes === 1 ? "" : "s"}.` };
  }
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
