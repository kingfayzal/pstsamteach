"use server";

import { revalidatePath } from "next/cache";
import { formDataToObject, type FormState } from "@/lib/validation/form";
import { endOtherSessions, requireUser } from "@/server/auth/session";
import { changePassword, setTimeZone, updateProfile } from "@/server/services/accounts";
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
  await endOtherSessions(user.id);
  return successState("Password changed. Other devices have been signed out.");
}

export async function setTimeZoneAction(_prev: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const result = await setTimeZone(user, formDataToObject(form));
  if (!result.ok) return errorState(result, form);
  revalidatePath("/", "layout");
  return successState("Time zone saved. Times across the site now use it.");
}
