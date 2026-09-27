"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { formDataToObject, type FormState } from "@/lib/validation/form";
import { requestLimiter } from "@/server/auth/rate-limit";
import { requireRole } from "@/server/auth/session";
import { requestTeacher } from "@/server/services/connections";
import { saveReview, toggleSavedTeacher } from "@/server/services/teacher-social";
import { errorState, successState } from "./helpers";

export async function requestTeacherAction(teacherId: string, _prev: FormState, form: FormData): Promise<FormState> {
  const user = await requireRole("STUDENT");
  const limit = await requestLimiter.hit(`request:${user.id}`);
  if (!limit.allowed) return { ok: false, message: "You've sent a lot of requests in the last hour. Try again later." };

  const result = await requestTeacher(user, teacherId, formDataToObject(form));
  if (!result.ok) return errorState(result, form);
  revalidatePath("/learn", "layout");
  redirect(`/learn/teachers/${result.data.connectionId}?notice=request-sent`);
}

export async function toggleSavedTeacherAction(teacherId: string, _prev: FormState): Promise<FormState> {
  const user = await requireRole("STUDENT");
  const result = await toggleSavedTeacher(user, teacherId);
  if (!result.ok) return errorState(result);
  revalidatePath("/teachers", "layout");
  return successState(result.data.saved ? "Saved to your shortlist." : "Removed from your shortlist.");
}

export async function saveReviewAction(teacherId: string, slug: string, _prev: FormState, form: FormData): Promise<FormState> {
  const user = await requireRole("STUDENT");
  const result = await saveReview(user, teacherId, formDataToObject(form));
  if (!result.ok) return errorState(result, form);
  revalidatePath(`/teachers/${encodeURIComponent(slug)}`);
  return successState("Review saved. Thank you for helping other students choose.");
}
