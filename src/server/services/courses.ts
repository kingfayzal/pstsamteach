import "server-only";
import type { CourseStatus } from "@/generated/prisma/enums";
import { type CourseAction, submissionBlockers, transitionCourse } from "@/lib/course-lifecycle";
import { randomSuffix, slugify, withSuffix } from "@/lib/slug";
import { reviewNoteSchema } from "@/lib/validation/admin";
import { courseSchema } from "@/lib/validation/course";
import { db } from "@/server/db";
import { recordAudit } from "./audit";
import { loadManagedCourse } from "./guards";
import { type Actor, fail, forbidden, invalid, isActiveRole, notFound, ok, type ServiceResult } from "./result";

async function uniqueCourseSlug(title: string): Promise<string> {
  const base = slugify(title);
  let candidate = base;
  for (let attempt = 0; attempt < 6; attempt++) {
    if ((await db.course.count({ where: { slug: candidate } })) === 0) return candidate;
    candidate = withSuffix(base, randomSuffix());
  }
  return withSuffix(base, `${Date.now().toString(36)}`);
}

async function activeSubjectExists(subjectId: string): Promise<boolean> {
  return (await db.subject.count({ where: { id: subjectId, isActive: true } })) > 0;
}

const SUBJECT_UNAVAILABLE = "Choose one of the listed subjects.";

export async function createCourse(actor: Actor, input: unknown): Promise<ServiceResult<{ id: string; slug: string }>> {
  if (!isActiveRole(actor, "TEACHER")) return forbidden("Only approved teachers can create courses.");
  const parsed = courseSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  if (!(await activeSubjectExists(parsed.data.subjectId))) {
    return fail("INVALID", SUBJECT_UNAVAILABLE, { subjectId: [SUBJECT_UNAVAILABLE] });
  }
  const course = await db.course.create({
    data: { ...parsed.data, slug: await uniqueCourseSlug(parsed.data.title), teacherId: actor.id },
    select: { id: true, slug: true },
  });
  return ok(course);
}

export async function updateCourse(actor: Actor, courseId: string, input: unknown): Promise<ServiceResult<null>> {
  const guard = await loadManagedCourse(actor, courseId, { requireEditable: true });
  if (!guard.ok) return guard;
  const parsed = courseSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  if (!(await activeSubjectExists(parsed.data.subjectId))) {
    return fail("INVALID", SUBJECT_UNAVAILABLE, { subjectId: [SUBJECT_UNAVAILABLE] });
  }
  await db.course.update({ where: { id: courseId }, data: parsed.data });
  return ok(null);
}

type StatusChange = { status: CourseStatus; submittedAt?: Date; publishedAt?: Date; reviewNote?: string | null; isFeatured?: boolean };

function changeFor(action: CourseAction, status: CourseStatus, note: string | null, publishedAt: Date | null): StatusChange {
  const now = new Date();
  switch (action) {
    case "submit":
      return { status, submittedAt: now, reviewNote: null };
    case "approve":
      return { status, publishedAt: publishedAt ?? now, reviewNote: null };
    case "reject":
      return { status, reviewNote: note };
    case "unpublish":
    case "archive":
      return { status, isFeatured: false };
    default:
      return { status };
  }
}

const AUDIT_VERB: Record<CourseAction, string> = {
  submit: "Submitted for review",
  withdraw: "Withdrew from review",
  approve: "Approved and published",
  reject: "Sent back to draft",
  unpublish: "Unpublished",
  archive: "Archived",
  restore: "Restored",
};

export async function changeCourseStatus(
  actor: Actor,
  courseId: string,
  action: CourseAction,
  input: unknown = {},
): Promise<ServiceResult<{ status: CourseStatus }>> {
  const guard = await loadManagedCourse(actor, courseId);
  if (!guard.ok) return guard;
  const course = await db.course.findUniqueOrThrow({
    where: { id: courseId },
    select: { status: true, description: true, publishedAt: true, _count: { select: { lessons: true } } },
  });

  const transition = transitionCourse(course.status, action, actor.role);
  if (!transition.ok) return fail("CONFLICT", transition.error);

  if (action === "submit") {
    const blockers = submissionBlockers({ lessonCount: course._count.lessons, description: course.description });
    if (blockers.length > 0) return fail("INVALID", `Before submitting: ${blockers.join(" ")}`);
  }

  let note: string | null = null;
  if (action === "reject") {
    const parsed = reviewNoteSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    note = parsed.data.note;
  }

  await db.$transaction(async (tx) => {
    await tx.course.update({ where: { id: courseId }, data: changeFor(action, transition.status, note, course.publishedAt) });
    await recordAudit(tx, {
      actorId: actor.id,
      action: `course.${action}`,
      entity: "course",
      entityId: courseId,
      summary: `${AUDIT_VERB[action]}: ${guard.data.title}`,
    });
  });
  return ok({ status: transition.status });
}

export async function setCourseFeatured(actor: Actor, courseId: string, featured: boolean): Promise<ServiceResult<null>> {
  if (!isActiveRole(actor, "ADMIN")) return forbidden();
  const course = await db.course.findUnique({ where: { id: courseId }, select: { status: true, title: true } });
  if (!course) return notFound("That course");
  if (featured && course.status !== "PUBLISHED") return fail("CONFLICT", "Only published courses can be featured.");
  await db.$transaction(async (tx) => {
    await tx.course.update({ where: { id: courseId }, data: { isFeatured: featured } });
    await recordAudit(tx, {
      actorId: actor.id,
      action: featured ? "course.feature" : "course.unfeature",
      entity: "course",
      entityId: courseId,
      summary: `${featured ? "Featured" : "Removed from featured"}: ${course.title}`,
    });
  });
  return ok(null);
}
