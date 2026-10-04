import "server-only";
import { findBookableSlot, BOOKING_HORIZON_DAYS } from "@/lib/scheduling";
import { connectionRequestSchema, declineSchema } from "@/lib/validation/teacher";
import { db } from "@/server/db";
import { getVideoProvider, type VideoProvider } from "@/server/video";
import { closeLiveRooms } from "./live-sessions";
import { busyIntervals, loadSchedulingProfile, lockSchedules, profileIsListed } from "./teacher-common";
import { type Actor, fail, forbidden, invalid, isActiveRole, notFound, ok, type ServiceResult } from "./result";

export const MAX_PENDING_REQUESTS = 5;
const DAY = 24 * 60 * 60 * 1000;

/** A student asks a teacher to take them on, optionally proposing a first session. */
export async function requestTeacher(
  actor: Actor,
  teacherId: string,
  input: unknown,
  now = new Date(),
): Promise<ServiceResult<{ connectionId: string }>> {
  if (!isActiveRole(actor, "STUDENT")) return forbidden("Only student accounts can choose a teacher.");
  const profile = await loadSchedulingProfile(db, teacherId);
  if (!profile || !profileIsListed(profile)) return notFound("That teacher");
  if (!profile.acceptingStudents) return fail("CONFLICT", `${profile.user.name} isn't taking new students right now.`);

  const existing = await db.teacherConnection.findUnique({
    where: { studentId_teacherId: { studentId: actor.id, teacherId } },
    select: { id: true, status: true },
  });
  if (existing?.status === "PENDING") return fail("CONFLICT", "You've already asked this teacher. They'll reply soon.");
  if (existing?.status === "ACTIVE") return fail("CONFLICT", "This is already one of your teachers.");

  const pending = await db.teacherConnection.count({ where: { studentId: actor.id, status: "PENDING" } });
  if (pending >= MAX_PENDING_REQUESTS) {
    return fail("CONFLICT", `You have ${MAX_PENDING_REQUESTS} requests waiting. Wait for a reply, or withdraw one, before asking another teacher.`);
  }

  const parsed = connectionRequestSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { topicId, goals, slotStart, agenda } = parsed.data;
  if (topicId && !profile.topics.some((t) => t.topicId === topicId)) {
    return fail("INVALID", "Choose one of this teacher's topics.", { topicId: ["Choose one of this teacher's topics."] });
  }

  const connection = await db.$transaction(async (tx) => {
    // Also serialises a double-submitted request, so the second one just updates the first.
    await lockSchedules(tx, [teacherId, actor.id]);
    let slot = null;
    if (slotStart) {
      const busy = await busyIntervals(tx, { teacherId, studentId: actor.id }, now, new Date(now.getTime() + (BOOKING_HORIZON_DAYS + 1) * DAY));
      slot = findBookableSlot(slotStart, {
        windows: profile.availability,
        timeZone: profile.timeZone,
        sessionMinutes: profile.sessionMinutes,
        now,
        busy,
      });
      if (!slot) return null;
    }
    const saved = await tx.teacherConnection.upsert({
      where: { studentId_teacherId: { studentId: actor.id, teacherId } },
      create: { studentId: actor.id, teacherId, topicId, goals },
      update: { topicId, goals, status: "PENDING", responseNote: null, respondedAt: null, endedAt: null, endedById: null },
      select: { id: true },
    });
    if (slot) {
      await tx.tutoringSession.create({
        data: { connectionId: saved.id, teacherId, startsAt: slot.start, endsAt: slot.end, status: "REQUESTED", agenda },
      });
    }
    return saved;
  });
  if (!connection) return fail("CONFLICT", "That time has just been taken. Choose another one.", { slotStart: ["That time has just been taken."] });
  return ok({ connectionId: connection.id });
}

/** The teacher accepts or declines a pending request. */
export async function respondToRequest(
  actor: Actor,
  connectionId: string,
  accept: boolean,
  input: unknown = {},
  now = new Date(),
): Promise<ServiceResult<{ status: "ACTIVE" | "DECLINED" }>> {
  if (!isActiveRole(actor, "TEACHER")) return forbidden();
  const connection = await db.teacherConnection.findUnique({
    where: { id: connectionId },
    select: { id: true, teacherId: true, status: true, sessions: { where: { status: "REQUESTED" }, select: { id: true, startsAt: true, endsAt: true } } },
  });
  if (!connection || connection.teacherId !== actor.id) return notFound("That request");
  if (connection.status !== "PENDING") return fail("CONFLICT", "You've already replied to this request.");

  const parsed = declineSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);

  const replied = await db.$transaction(async (tx) => {
    await lockSchedules(tx, [actor.id]);
    // Only a still-pending request changes, so a double-submitted reply applies once.
    const claimed = await tx.teacherConnection.updateMany({
      where: { id: connectionId, status: "PENDING" },
      data: { status: accept ? "ACTIVE" : "DECLINED", respondedAt: now, responseNote: accept ? null : parsed.data.note },
    });
    if (claimed.count === 0) return false;
    for (const session of connection.sessions) {
      const clash =
        accept &&
        (await tx.tutoringSession.count({
          where: { id: { not: session.id }, teacherId: actor.id, status: "CONFIRMED", startsAt: { lt: session.endsAt }, endsAt: { gt: session.startsAt } },
        })) > 0;
      const keep = accept && session.startsAt > now && !clash;
      await tx.tutoringSession.update({
        where: { id: session.id },
        data: keep
          ? { status: "CONFIRMED" }
          : {
              status: "CANCELLED",
              cancelledById: actor.id,
              cancelReason: !accept ? "Request declined." : session.startsAt <= now ? "The time passed before the request was accepted." : "That time is no longer free.",
            },
      });
    }
    return true;
  });
  if (!replied) return fail("CONFLICT", "You've already replied to this request.");
  return ok({ status: accept ? "ACTIVE" : "DECLINED" });
}

/** Either side stops working together (or a student withdraws a pending request). */
export async function endConnection(
  actor: Actor,
  connectionId: string,
  now = new Date(),
  provider: VideoProvider | null = getVideoProvider(),
): Promise<ServiceResult<null>> {
  const connection = await db.teacherConnection.findUnique({
    where: { id: connectionId },
    select: { id: true, studentId: true, teacherId: true, status: true },
  });
  const isParty = connection && (connection.studentId === actor.id || connection.teacherId === actor.id);
  if (!connection || !isParty) return notFound("That connection");
  if (connection.status !== "ACTIVE" && connection.status !== "PENDING") return fail("CONFLICT", "This has already ended.");

  await db.$transaction([
    db.teacherConnection.update({ where: { id: connectionId }, data: { status: "ENDED", endedAt: now, endedById: actor.id } }),
    db.tutoringSession.updateMany({
      where: { connectionId, status: { in: ["REQUESTED", "CONFIRMED"] }, startsAt: { gt: now } },
      data: { status: "CANCELLED", cancelledById: actor.id, cancelReason: "No longer working together." },
    }),
  ]);
  // Including a session in progress: neither person should stay in a call after stopping.
  await closeLiveRooms({ connectionId }, now, provider);
  return ok(null);
}
