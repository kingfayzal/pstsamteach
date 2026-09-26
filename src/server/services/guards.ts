import "server-only";
import type { CourseStatus } from "@/generated/prisma/enums";
import { canTeacherEditContent } from "@/lib/course-lifecycle";
import { db } from "@/server/db";
import { type Actor, fail, isActiveRole, notFound, ok, type ServiceResult } from "./result";

export type ManagedCourse = { id: string; title: string; teacherId: string; status: CourseStatus };

const LOCKED_MESSAGE: Partial<Record<CourseStatus, string>> = {
  IN_REVIEW: "This course is being reviewed. Withdraw it from review to make changes.",
  ARCHIVED: "This course is archived. Ask an admin to restore it before making changes.",
};

export function canManageCourse(actor: Actor, course: { teacherId: string }): boolean {
  if (isActiveRole(actor, "ADMIN")) return true;
  return isActiveRole(actor, "TEACHER") && course.teacherId === actor.id;
}

/**
 * Load a course the actor may manage (its teacher, or an admin). Courses the
 * actor can't manage come back as "not found" so their existence isn't leaked.
 */
export async function loadManagedCourse(
  actor: Actor,
  courseId: string,
  options: { requireEditable?: boolean } = {},
): Promise<ServiceResult<ManagedCourse>> {
  const course = await db.course.findUnique({
    where: { id: courseId },
    select: { id: true, title: true, teacherId: true, status: true },
  });
  if (!course || !canManageCourse(actor, course)) return notFound("That course");
  if (options.requireEditable && actor.role !== "ADMIN" && !canTeacherEditContent(course.status)) {
    return fail("CONFLICT", LOCKED_MESSAGE[course.status] ?? "This course can't be edited right now.");
  }
  return ok(course);
}

export async function loadManagedLesson(actor: Actor, lessonId: string, options: { requireEditable?: boolean } = {}) {
  const lesson = await db.lesson.findUnique({ where: { id: lessonId }, select: { id: true, courseId: true, position: true } });
  if (!lesson) return notFound("That lesson");
  const course = await loadManagedCourse(actor, lesson.courseId, options);
  if (!course.ok) return course.code === "NOT_FOUND" ? notFound("That lesson") : course;
  return ok({ lesson, course: course.data });
}

export async function loadManagedAssessment(
  actor: Actor,
  assessmentId: string,
  options: { requireEditable?: boolean } = {},
) {
  const assessment = await db.assessment.findUnique({
    where: { id: assessmentId },
    select: { id: true, courseId: true, kind: true, isPublished: true, maxPoints: true, _count: { select: { questions: true, submissions: true } } },
  });
  if (!assessment) return notFound("That assessment");
  const course = await loadManagedCourse(actor, assessment.courseId, options);
  if (!course.ok) return course.code === "NOT_FOUND" ? notFound("That assessment") : course;
  return ok({ assessment, course: course.data });
}
