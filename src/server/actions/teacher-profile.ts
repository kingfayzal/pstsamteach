"use server";

import { revalidatePath } from "next/cache";
import { formDataToObject, type FormState } from "@/lib/validation/form";
import { requireRole } from "@/server/auth/session";
import { removeTeacherPhoto, setTeacherAvailability, updateTeacherProfile, uploadTeacherPhoto } from "@/server/services/teacher-profiles";
import { errorState, successState } from "./helpers";

function refreshProfile() {
  revalidatePath("/teach", "layout");
  revalidatePath("/teachers", "layout");
}

export async function updateTeacherProfileAction(_prev: FormState, form: FormData): Promise<FormState> {
  const user = await requireRole("TEACHER", { allowPending: true });
  const result = await updateTeacherProfile(user, formDataToObject(form, ["topicIds", "languages"]));
  if (!result.ok) return errorState(result, form, ["topicIds", "languages"]);
  refreshProfile();
  return successState("Profile saved.");
}

export async function saveAvailabilityAction(_prev: FormState, form: FormData): Promise<FormState> {
  const user = await requireRole("TEACHER", { allowPending: true });
  const result = await setTeacherAvailability(user, formDataToObject(form));
  if (!result.ok) return errorState(result);
  refreshProfile();
  return successState(result.data.windows ? "Availability saved." : "Availability cleared. Students can't book you until you add some times.");
}

export async function uploadPhotoAction(_prev: FormState, form: FormData): Promise<FormState> {
  const user = await requireRole("TEACHER", { allowPending: true });
  const file = form.get("photo");
  const bytes = file instanceof File && file.size > 0 ? new Uint8Array(await file.arrayBuffer()) : null;
  const result = await uploadTeacherPhoto(user, bytes);
  if (!result.ok) return errorState(result);
  refreshProfile();
  return successState("Photo updated.");
}

export async function removePhotoAction(_prev: FormState): Promise<FormState> {
  const user = await requireRole("TEACHER", { allowPending: true });
  const result = await removeTeacherPhoto(user);
  if (!result.ok) return errorState(result);
  refreshProfile();
  return successState("Photo removed.");
}
