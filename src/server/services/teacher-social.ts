import "server-only";
import { messageSchema, reviewSchema } from "@/lib/validation/teacher";
import { db } from "@/server/db";
import { recordAudit } from "./audit";
import { type Actor, fail, forbidden, invalid, isActiveRole, notFound, ok, type ServiceResult } from "./result";

async function loadParty(actor: Actor, connectionId: string) {
  const connection = await db.teacherConnection.findUnique({
    where: { id: connectionId },
    select: { id: true, studentId: true, teacherId: true, status: true },
  });
  if (!connection || (connection.studentId !== actor.id && connection.teacherId !== actor.id)) return null;
  return connection;
}

export async function sendMessage(actor: Actor, connectionId: string, input: unknown): Promise<ServiceResult<{ id: string }>> {
  if (actor.status === "SUSPENDED") return forbidden();
  const connection = await loadParty(actor, connectionId);
  if (!connection) return notFound("That conversation");
  if (connection.status !== "PENDING" && connection.status !== "ACTIVE") {
    return fail("CONFLICT", "This conversation is closed because you're no longer working together.");
  }
  const parsed = messageSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const message = await db.message.create({ data: { connectionId, senderId: actor.id, body: parsed.data.body }, select: { id: true } });
  return ok(message);
}

/** Mark the other person's messages as read. */
export async function markThreadRead(actor: Actor, connectionId: string, now = new Date()): Promise<ServiceResult<{ updated: number }>> {
  const connection = await loadParty(actor, connectionId);
  if (!connection) return notFound("That conversation");
  const { count } = await db.message.updateMany({
    where: { connectionId, senderId: { not: actor.id }, readAt: null },
    data: { readAt: now },
  });
  return ok({ updated: count });
}

/** Students review a teacher once they've actually had a session together. */
export async function saveReview(actor: Actor, teacherId: string, input: unknown, now = new Date()): Promise<ServiceResult<null>> {
  if (!isActiveRole(actor, "STUDENT")) return forbidden("Only students can review teachers.");
  const hadSession = await db.tutoringSession.count({
    where: { teacherId, status: "CONFIRMED", endsAt: { lte: now }, connection: { studentId: actor.id, status: { in: ["ACTIVE", "ENDED"] } } },
  });
  if (hadSession === 0) return fail("CONFLICT", "You can review a teacher after your first session with them.");
  const parsed = reviewSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  await db.teacherReview.upsert({
    where: { teacherId_studentId: { teacherId, studentId: actor.id } },
    create: { teacherId, studentId: actor.id, ...parsed.data },
    update: parsed.data,
  });
  return ok(null);
}

export async function setReviewHidden(actor: Actor, reviewId: string, hidden: boolean): Promise<ServiceResult<null>> {
  if (!isActiveRole(actor, "ADMIN")) return forbidden();
  const review = await db.teacherReview.findUnique({
    where: { id: reviewId },
    select: { id: true, teacher: { select: { name: true } }, student: { select: { name: true } } },
  });
  if (!review) return notFound("That review");
  await db.$transaction(async (tx) => {
    await tx.teacherReview.update({ where: { id: reviewId }, data: { isHidden: hidden } });
    await recordAudit(tx, {
      actorId: actor.id,
      action: hidden ? "review.hide" : "review.unhide",
      entity: "user",
      entityId: reviewId,
      summary: `${hidden ? "Hid" : "Restored"} a review of ${review.teacher.name} by ${review.student.name}`,
    });
  });
  return ok(null);
}

/** Save or unsave a teacher to the student's shortlist. */
export async function toggleSavedTeacher(actor: Actor, teacherId: string): Promise<ServiceResult<{ saved: boolean }>> {
  if (!isActiveRole(actor, "STUDENT")) return forbidden("Only students can save teachers.");
  const profile = await db.teacherProfile.findUnique({ where: { userId: teacherId }, select: { id: true } });
  if (!profile) return notFound("That teacher");
  const key = { studentId_teacherId: { studentId: actor.id, teacherId } };
  const existing = await db.savedTeacher.findUnique({ where: key, select: { studentId: true } });
  if (existing) {
    await db.savedTeacher.delete({ where: key });
    return ok({ saved: false });
  }
  await db.savedTeacher.create({ data: { studentId: actor.id, teacherId } });
  return ok({ saved: true });
}
