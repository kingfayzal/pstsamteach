import "server-only";
import { platformAnnouncementSchema } from "@/lib/validation/admin";
import { announcementSchema } from "@/lib/validation/course";
import { db } from "@/server/db";
import { recordAudit } from "./audit";
import { loadManagedCourse } from "./guards";
import { type Actor, forbidden, invalid, isActiveRole, notFound, ok, type ServiceResult } from "./result";

export async function postCourseAnnouncement(actor: Actor, courseId: string, input: unknown): Promise<ServiceResult<{ id: string }>> {
  const guard = await loadManagedCourse(actor, courseId);
  if (!guard.ok) return guard;
  const parsed = announcementSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const announcement = await db.announcement.create({
    data: { ...parsed.data, courseId, authorId: actor.id, audience: "STUDENTS" },
    select: { id: true },
  });
  return ok(announcement);
}

export async function postPlatformAnnouncement(actor: Actor, input: unknown): Promise<ServiceResult<{ id: string }>> {
  if (!isActiveRole(actor, "ADMIN")) return forbidden();
  const parsed = platformAnnouncementSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const announcement = await db.$transaction(async (tx) => {
    const created = await tx.announcement.create({ data: { ...parsed.data, authorId: actor.id }, select: { id: true } });
    await recordAudit(tx, {
      actorId: actor.id,
      action: "announcement.post",
      entity: "announcement",
      entityId: created.id,
      summary: `Posted announcement: ${parsed.data.title}`,
    });
    return created;
  });
  return ok(announcement);
}

export async function deleteAnnouncement(actor: Actor, announcementId: string): Promise<ServiceResult<null>> {
  const announcement = await db.announcement.findUnique({
    where: { id: announcementId },
    select: { id: true, authorId: true, course: { select: { teacherId: true } } },
  });
  if (!announcement) return notFound("That announcement");
  const allowed =
    isActiveRole(actor, "ADMIN") || (announcement.course !== null && isActiveRole(actor, "TEACHER") && announcement.course.teacherId === actor.id);
  if (!allowed) return notFound("That announcement");
  await db.announcement.delete({ where: { id: announcementId } });
  return ok(null);
}
