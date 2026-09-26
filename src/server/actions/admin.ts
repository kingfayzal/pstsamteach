"use server";

import { revalidatePath } from "next/cache";
import type { CourseAction } from "@/lib/course-lifecycle";
import { formDataToObject, type FormState } from "@/lib/validation/form";
import { requireRole } from "@/server/auth/session";
import {
  approveTeacher,
  changeUserRole,
  createSubject,
  declineTeacher,
  reactivateUser,
  setSubjectActive,
  suspendUser,
  updateSubject,
} from "@/server/services/admin";
import { deleteAnnouncement, postPlatformAnnouncement } from "@/server/services/announcements";
import { changeCourseStatus, setCourseFeatured } from "@/server/services/courses";
import { errorState, readString, successState } from "./helpers";

function refreshAdmin() {
  revalidatePath("/admin", "layout");
}

export async function approveTeacherAction(userId: string, _prev: FormState): Promise<FormState> {
  const admin = await requireRole("ADMIN");
  const result = await approveTeacher(admin, userId);
  if (!result.ok) return errorState(result);
  refreshAdmin();
  return successState("Approved. They can create courses now.");
}

export async function declineTeacherAction(userId: string, _prev: FormState): Promise<FormState> {
  const admin = await requireRole("ADMIN");
  const result = await declineTeacher(admin, userId);
  if (!result.ok) return errorState(result);
  refreshAdmin();
  return successState("Declined. Their account now works as a student account.");
}

export async function suspendUserAction(userId: string, _prev: FormState): Promise<FormState> {
  const admin = await requireRole("ADMIN");
  const result = await suspendUser(admin, userId);
  if (!result.ok) return errorState(result);
  refreshAdmin();
  return successState("Suspended and signed out everywhere.");
}

export async function reactivateUserAction(userId: string, _prev: FormState): Promise<FormState> {
  const admin = await requireRole("ADMIN");
  const result = await reactivateUser(admin, userId);
  if (!result.ok) return errorState(result);
  refreshAdmin();
  return successState("Reactivated.");
}

export async function changeRoleAction(userId: string, _prev: FormState, form: FormData): Promise<FormState> {
  const admin = await requireRole("ADMIN");
  const result = await changeUserRole(admin, userId, readString(form, "role"));
  if (!result.ok) return errorState(result, form);
  refreshAdmin();
  return successState("Role changed. They'll need to sign in again.");
}

const ADMIN_ACTION_DONE: Partial<Record<CourseAction, string>> = {
  approve: "Approved and published. It's in the catalog now.",
  reject: "Sent back to the teacher with your notes.",
  unpublish: "Unpublished. It's back in draft and out of the catalog.",
  archive: "Archived. Enrolled students keep access; nobody new can enrol.",
  restore: "Restored to the catalog.",
};

export async function adminCourseStatusAction(courseId: string, action: CourseAction, _prev: FormState, form: FormData): Promise<FormState> {
  const admin = await requireRole("ADMIN");
  const result = await changeCourseStatus(admin, courseId, action, formDataToObject(form));
  if (!result.ok) return errorState(result, form);
  refreshAdmin();
  revalidatePath("/courses", "layout");
  revalidatePath("/");
  return successState(ADMIN_ACTION_DONE[action] ?? "Updated.");
}

export async function featureCourseAction(courseId: string, featured: boolean, _prev: FormState): Promise<FormState> {
  const admin = await requireRole("ADMIN");
  const result = await setCourseFeatured(admin, courseId, featured);
  if (!result.ok) return errorState(result);
  refreshAdmin();
  revalidatePath("/");
  return successState(featured ? "Featured on the home page." : "Removed from the home page.");
}

export async function createSubjectAction(_prev: FormState, form: FormData): Promise<FormState> {
  const admin = await requireRole("ADMIN");
  const result = await createSubject(admin, formDataToObject(form));
  if (!result.ok) return errorState(result, form);
  refreshAdmin();
  revalidatePath("/", "layout");
  return successState("Subject added. Teachers can create courses in it now.");
}

export async function updateSubjectAction(subjectId: string, _prev: FormState, form: FormData): Promise<FormState> {
  const admin = await requireRole("ADMIN");
  const result = await updateSubject(admin, subjectId, formDataToObject(form));
  if (!result.ok) return errorState(result, form);
  refreshAdmin();
  revalidatePath("/", "layout");
  return successState("Subject saved.");
}

export async function toggleSubjectAction(subjectId: string, isActive: boolean, _prev: FormState): Promise<FormState> {
  const admin = await requireRole("ADMIN");
  const result = await setSubjectActive(admin, subjectId, isActive);
  if (!result.ok) return errorState(result);
  refreshAdmin();
  revalidatePath("/", "layout");
  return successState(isActive ? "Subject opened." : "Subject closed. Its courses are hidden from the catalog.");
}

export async function postPlatformAnnouncementAction(_prev: FormState, form: FormData): Promise<FormState> {
  const admin = await requireRole("ADMIN");
  const result = await postPlatformAnnouncement(admin, formDataToObject(form));
  if (!result.ok) return errorState(result, form);
  refreshAdmin();
  revalidatePath("/learn");
  revalidatePath("/teach");
  return successState("Announcement posted.");
}

export async function deletePlatformAnnouncementAction(announcementId: string, _prev: FormState): Promise<FormState> {
  const admin = await requireRole("ADMIN");
  const result = await deleteAnnouncement(admin, announcementId);
  if (!result.ok) return errorState(result);
  refreshAdmin();
  return successState("Announcement deleted.");
}
