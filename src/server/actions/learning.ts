"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { FormState } from "@/lib/validation/form";
import { requireRole } from "@/server/auth/session";
import { enrollInCourse, setLessonComplete } from "@/server/services/enrollment";
import { submitAssignment, submitQuiz } from "@/server/services/submissions";
import { errorState, readString, successState } from "./helpers";

export async function enrollAction(courseId: string, _prev: FormState, _form: FormData): Promise<FormState> {
  const user = await requireRole("STUDENT");
  const result = await enrollInCourse(user, courseId);
  if (!result.ok) return errorState(result);
  revalidatePath("/learn");
  redirect(`/learn/courses/${result.data.slug}?notice=enrolled`);
}

export async function toggleLessonAction(lessonId: string, courseSlug: string, _prev: FormState, form: FormData): Promise<FormState> {
  const user = await requireRole("STUDENT");
  const complete = readString(form, "complete") === "true";
  const result = await setLessonComplete(user, lessonId, complete);
  if (!result.ok) return errorState(result);
  revalidatePath(`/learn/courses/${courseSlug}`, "layout");
  revalidatePath("/learn");
  if (result.data.courseCompleted) return successState("Course complete. Well done.");
  return successState(complete ? "Marked as done." : "Marked as not done.");
}

export async function submitQuizAction(assessmentId: string, courseSlug: string, _prev: FormState, form: FormData): Promise<FormState> {
  const user = await requireRole("STUDENT");
  const answers: Record<string, string> = {};
  for (const [key, value] of form.entries()) {
    if (key.startsWith("q:") && typeof value === "string") answers[key.slice(2)] = value;
  }
  const result = await submitQuiz(user, assessmentId, answers);
  if (!result.ok) return errorState(result, form);
  revalidatePath(`/learn/courses/${courseSlug}`, "layout");
  revalidatePath("/learn");
  redirect(`/learn/courses/${courseSlug}/assessments/${assessmentId}?attempt=${result.data.submissionId}`);
}

export async function submitAssignmentAction(
  assessmentId: string,
  courseSlug: string,
  _prev: FormState,
  form: FormData,
): Promise<FormState> {
  const user = await requireRole("STUDENT");
  const result = await submitAssignment(user, assessmentId, { response: readString(form, "response") });
  if (!result.ok) return errorState(result, form);
  revalidatePath(`/learn/courses/${courseSlug}`, "layout");
  return successState("Submitted. Your teacher will mark it and you'll see the result here.");
}
