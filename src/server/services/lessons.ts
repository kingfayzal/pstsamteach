import "server-only";
import { lessonSchema } from "@/lib/validation/lesson";
import { db } from "@/server/db";
import { loadManagedCourse, loadManagedLesson } from "./guards";
import { fail, invalid, ok, type ServiceResult, type Actor } from "./result";

export async function createLesson(actor: Actor, courseId: string, input: unknown): Promise<ServiceResult<{ id: string }>> {
  const guard = await loadManagedCourse(actor, courseId, { requireEditable: true });
  if (!guard.ok) return guard;
  const parsed = lessonSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const last = await db.lesson.findFirst({ where: { courseId }, orderBy: { position: "desc" }, select: { position: true } });
  const lesson = await db.lesson.create({
    data: { ...parsed.data, courseId, position: (last?.position ?? 0) + 1 },
    select: { id: true },
  });
  return ok(lesson);
}

export async function updateLesson(actor: Actor, lessonId: string, input: unknown): Promise<ServiceResult<null>> {
  const guard = await loadManagedLesson(actor, lessonId, { requireEditable: true });
  if (!guard.ok) return guard;
  const parsed = lessonSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  await db.lesson.update({ where: { id: lessonId }, data: parsed.data });
  return ok(null);
}

export async function deleteLesson(actor: Actor, lessonId: string): Promise<ServiceResult<null>> {
  const guard = await loadManagedLesson(actor, lessonId, { requireEditable: true });
  if (!guard.ok) return guard;
  const { course } = guard.data;
  const remaining = await db.lesson.count({ where: { courseId: course.id } });
  if (course.status === "PUBLISHED" && remaining <= 1) {
    return fail("CONFLICT", "A published course needs at least one lesson. Add another lesson first.");
  }
  await db.$transaction(async (tx) => {
    await tx.lesson.delete({ where: { id: lessonId } });
    const rest = await tx.lesson.findMany({ where: { courseId: course.id }, orderBy: { position: "asc" }, select: { id: true } });
    for (const [index, lesson] of rest.entries()) {
      await tx.lesson.update({ where: { id: lesson.id }, data: { position: index + 1 } });
    }
  });
  return ok(null);
}

export async function moveLesson(actor: Actor, lessonId: string, direction: "up" | "down"): Promise<ServiceResult<null>> {
  const guard = await loadManagedLesson(actor, lessonId, { requireEditable: true });
  if (!guard.ok) return guard;
  const { lesson } = guard.data;
  const neighbour = await db.lesson.findFirst({
    where: {
      courseId: lesson.courseId,
      position: direction === "up" ? { lt: lesson.position } : { gt: lesson.position },
    },
    orderBy: { position: direction === "up" ? "desc" : "asc" },
    select: { id: true, position: true },
  });
  if (!neighbour) return ok(null);
  await db.$transaction([
    db.lesson.update({ where: { id: lesson.id }, data: { position: neighbour.position } }),
    db.lesson.update({ where: { id: neighbour.id }, data: { position: lesson.position } }),
  ]);
  return ok(null);
}
