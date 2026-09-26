import "server-only";
import { db } from "@/server/db";
import { syncEnrollmentCompletion } from "./progress-sync";
import { type Actor, fail, forbidden, isActiveRole, notFound, ok, type ServiceResult } from "./result";

export async function enrollInCourse(actor: Actor, courseId: string): Promise<ServiceResult<{ slug: string }>> {
  if (!isActiveRole(actor, "STUDENT")) return forbidden("Only student accounts can enrol in courses.");
  const course = await db.course.findFirst({ where: { id: courseId, status: "PUBLISHED" }, select: { id: true, slug: true } });
  if (!course) return notFound("That course");
  await db.enrollment.upsert({
    where: { userId_courseId: { userId: actor.id, courseId } },
    create: { userId: actor.id, courseId },
    update: {},
  });
  return ok({ slug: course.slug });
}

/** An enrolment in a course that is still live. Archived courses stay readable to enrolled students. */
export async function findActiveEnrollment(userId: string, courseId: string) {
  return db.enrollment.findFirst({
    where: { userId, courseId, course: { status: { in: ["PUBLISHED", "ARCHIVED"] } } },
    select: { id: true },
  });
}

export async function setLessonComplete(
  actor: Actor,
  lessonId: string,
  complete: boolean,
): Promise<ServiceResult<{ courseCompleted: boolean }>> {
  if (!isActiveRole(actor, "STUDENT")) return forbidden();
  const lesson = await db.lesson.findUnique({ where: { id: lessonId }, select: { id: true, courseId: true } });
  if (!lesson) return notFound("That lesson");
  if (!(await findActiveEnrollment(actor.id, lesson.courseId))) {
    return fail("FORBIDDEN", "Enrol in this course to track your progress.");
  }

  if (complete) {
    await db.lessonProgress.upsert({
      where: { userId_lessonId: { userId: actor.id, lessonId } },
      create: { userId: actor.id, lessonId },
      update: {},
    });
  } else {
    await db.lessonProgress.deleteMany({ where: { userId: actor.id, lessonId } });
  }
  const progress = await syncEnrollmentCompletion(db, actor.id, lesson.courseId);
  return ok({ courseCompleted: progress?.isComplete ?? false });
}
