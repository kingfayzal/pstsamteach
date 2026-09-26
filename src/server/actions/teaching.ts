"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { CourseAction } from "@/lib/course-lifecycle";
import { formDataToObject, type FormState } from "@/lib/validation/form";
import { requireUser } from "@/server/auth/session";
import { deleteAnnouncement, postCourseAnnouncement } from "@/server/services/announcements";
import {
  addQuestion,
  createAssessment,
  deleteAssessment,
  deleteQuestion,
  setAssessmentPublished,
  updateAssessment,
  updateQuestion,
} from "@/server/services/assessments";
import { changeCourseStatus, createCourse, updateCourse } from "@/server/services/courses";
import { createLesson, deleteLesson, moveLesson, updateLesson } from "@/server/services/lessons";
import { gradeSubmission } from "@/server/services/submissions";
import { errorState, successState } from "./helpers";

const coursePath = (courseId: string) => `/teach/courses/${courseId}`;

function refreshCourse(courseId: string) {
  revalidatePath(coursePath(courseId), "layout");
  revalidatePath("/teach");
}

// Courses -------------------------------------------------------------------

export async function createCourseAction(_prev: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const result = await createCourse(user, formDataToObject(form));
  if (!result.ok) return errorState(result, form);
  revalidatePath("/teach");
  redirect(`${coursePath(result.data.id)}?notice=course-created`);
}

export async function updateCourseAction(courseId: string, _prev: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const result = await updateCourse(user, courseId, formDataToObject(form));
  if (!result.ok) return errorState(result, form);
  refreshCourse(courseId);
  return successState("Course details saved.");
}

const TEACHER_ACTION_DONE: Partial<Record<CourseAction, string>> = {
  submit: "Submitted for review. An admin will check it and publish it or send notes back.",
  withdraw: "Withdrawn from review. You can edit it again.",
};

export async function teacherCourseStatusAction(courseId: string, action: CourseAction, _prev: FormState): Promise<FormState> {
  const user = await requireUser();
  if (action !== "submit" && action !== "withdraw") return { ok: false, message: "That action isn't available here." };
  const result = await changeCourseStatus(user, courseId, action);
  if (!result.ok) return errorState(result);
  refreshCourse(courseId);
  return successState(TEACHER_ACTION_DONE[action] ?? "Updated.");
}

// Lessons -------------------------------------------------------------------

export async function createLessonAction(courseId: string, _prev: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const result = await createLesson(user, courseId, formDataToObject(form));
  if (!result.ok) return errorState(result, form);
  refreshCourse(courseId);
  redirect(`${coursePath(courseId)}?notice=lesson-added`);
}

export async function updateLessonAction(courseId: string, lessonId: string, _prev: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const result = await updateLesson(user, lessonId, formDataToObject(form));
  if (!result.ok) return errorState(result, form);
  refreshCourse(courseId);
  return successState("Lesson saved.");
}

export async function deleteLessonAction(courseId: string, lessonId: string, _prev: FormState): Promise<FormState> {
  const user = await requireUser();
  const result = await deleteLesson(user, lessonId);
  if (!result.ok) return errorState(result);
  refreshCourse(courseId);
  redirect(`${coursePath(courseId)}?notice=lesson-deleted`);
}

export async function moveLessonAction(courseId: string, lessonId: string, direction: "up" | "down", _prev: FormState): Promise<FormState> {
  const user = await requireUser();
  const result = await moveLesson(user, lessonId, direction);
  if (!result.ok) return errorState(result);
  refreshCourse(courseId);
  return undefined;
}

// Assessments ---------------------------------------------------------------

export async function createAssessmentAction(courseId: string, _prev: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const result = await createAssessment(user, courseId, formDataToObject(form));
  if (!result.ok) return errorState(result, form);
  refreshCourse(courseId);
  redirect(`${coursePath(courseId)}/assessments/${result.data.id}?notice=assessment-created`);
}

export async function updateAssessmentAction(courseId: string, assessmentId: string, _prev: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const result = await updateAssessment(user, assessmentId, formDataToObject(form));
  if (!result.ok) return errorState(result, form);
  refreshCourse(courseId);
  return successState("Settings saved.");
}

export async function deleteAssessmentAction(courseId: string, assessmentId: string, _prev: FormState): Promise<FormState> {
  const user = await requireUser();
  const result = await deleteAssessment(user, assessmentId);
  if (!result.ok) return errorState(result);
  refreshCourse(courseId);
  redirect(`${coursePath(courseId)}?notice=assessment-deleted`);
}

export async function publishAssessmentAction(courseId: string, assessmentId: string, published: boolean, _prev: FormState): Promise<FormState> {
  const user = await requireUser();
  const result = await setAssessmentPublished(user, assessmentId, published);
  if (!result.ok) return errorState(result);
  refreshCourse(courseId);
  return successState(published ? "Published. Enrolled students can see it now." : "Unpublished. Students can't see it now.");
}

export async function addQuestionAction(courseId: string, assessmentId: string, _prev: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const result = await addQuestion(user, assessmentId, formDataToObject(form, ["options"]));
  if (!result.ok) return errorState(result, form, ["options"]);
  refreshCourse(courseId);
  return successState("Question added.");
}

export async function updateQuestionAction(courseId: string, questionId: string, _prev: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const result = await updateQuestion(user, questionId, formDataToObject(form, ["options"]));
  if (!result.ok) return errorState(result, form, ["options"]);
  refreshCourse(courseId);
  return successState("Question saved.");
}

export async function deleteQuestionAction(courseId: string, questionId: string, _prev: FormState): Promise<FormState> {
  const user = await requireUser();
  const result = await deleteQuestion(user, questionId);
  if (!result.ok) return errorState(result);
  refreshCourse(courseId);
  return successState("Question deleted.");
}

// Marking and announcements ------------------------------------------------

export async function gradeSubmissionAction(submissionId: string, _prev: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const result = await gradeSubmission(user, submissionId, formDataToObject(form));
  if (!result.ok) return errorState(result, form);
  revalidatePath("/teach", "layout");
  redirect("/teach/marking?notice=marked");
}

export async function postAnnouncementAction(courseId: string, _prev: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const result = await postCourseAnnouncement(user, courseId, formDataToObject(form));
  if (!result.ok) return errorState(result, form);
  refreshCourse(courseId);
  return successState("Announcement posted to enrolled students.");
}

export async function deleteAnnouncementAction(courseId: string, announcementId: string, _prev: FormState): Promise<FormState> {
  const user = await requireUser();
  const result = await deleteAnnouncement(user, announcementId);
  if (!result.ok) return errorState(result);
  refreshCourse(courseId);
  return successState("Announcement deleted.");
}
