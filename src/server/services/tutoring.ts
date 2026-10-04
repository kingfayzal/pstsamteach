import "server-only";
import { BOOKING_HORIZON_DAYS, findBookableSlot } from "@/lib/scheduling";
import { bookingSchema, cancelSchema } from "@/lib/validation/teacher";
import { db } from "@/server/db";
import { getVideoProvider, type VideoProvider } from "@/server/video";
import { closeLiveRooms } from "./live-sessions";
import { busyIntervals, loadSchedulingProfile, lockSchedules } from "./teacher-common";
import { type Actor, fail, forbidden, invalid, isActiveRole, notFound, ok, type ServiceResult } from "./result";

export const MAX_UPCOMING_SESSIONS = 10;
const DAY = 24 * 60 * 60 * 1000;

/** A student books a session with a teacher they're working with. */
export async function bookSession(
  actor: Actor,
  connectionId: string,
  input: unknown,
  now = new Date(),
): Promise<ServiceResult<{ sessionId: string }>> {
  if (!isActiveRole(actor, "STUDENT")) return forbidden();
  const connection = await db.teacherConnection.findUnique({
    where: { id: connectionId },
    select: { id: true, studentId: true, teacherId: true, status: true },
  });
  if (!connection || connection.studentId !== actor.id) return notFound("That teacher");
  if (connection.status !== "ACTIVE") return fail("CONFLICT", "You can book sessions once the teacher has accepted you.");

  const parsed = bookingSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);

  const profile = await loadSchedulingProfile(db, connection.teacherId);
  if (!profile || profile.user.status !== "ACTIVE") return fail("CONFLICT", "This teacher isn't available for bookings right now.");

  const upcoming = await db.tutoringSession.count({
    where: { connectionId, status: { in: ["REQUESTED", "CONFIRMED"] }, startsAt: { gt: now } },
  });
  if (upcoming >= MAX_UPCOMING_SESSIONS) {
    return fail("CONFLICT", `You already have ${MAX_UPCOMING_SESSIONS} sessions booked with this teacher. Book more after some of them happen.`);
  }

  const session = await db.$transaction(async (tx) => {
    await lockSchedules(tx, [connection.teacherId, actor.id]);
    const busy = await busyIntervals(tx, { teacherId: connection.teacherId, studentId: actor.id }, now, new Date(now.getTime() + (BOOKING_HORIZON_DAYS + 1) * DAY));
    const slot = findBookableSlot(parsed.data.slotStart, {
      windows: profile.availability,
      timeZone: profile.timeZone,
      sessionMinutes: profile.sessionMinutes,
      now,
      busy,
    });
    if (!slot) return null;
    return tx.tutoringSession.create({
      data: { connectionId, teacherId: connection.teacherId, startsAt: slot.start, endsAt: slot.end, status: "CONFIRMED", agenda: parsed.data.agenda },
      select: { id: true },
    });
  });
  if (!session) return fail("CONFLICT", "That time isn't free any more. Choose another one.", { slotStart: ["That time isn't free any more."] });
  return ok({ sessionId: session.id });
}

/** Either side cancels a session that hasn't started yet; anyone already in its video room is let go. */
export async function cancelSession(
  actor: Actor,
  sessionId: string,
  input: unknown = {},
  now = new Date(),
  provider: VideoProvider | null = getVideoProvider(),
): Promise<ServiceResult<null>> {
  const session = await db.tutoringSession.findUnique({
    where: { id: sessionId },
    select: { id: true, status: true, startsAt: true, connection: { select: { studentId: true, teacherId: true } } },
  });
  const isParty = session && (session.connection.studentId === actor.id || session.connection.teacherId === actor.id);
  if (!session || !isParty) return notFound("That session");
  if (session.status === "CANCELLED") return fail("CONFLICT", "This session is already cancelled.");
  if (session.startsAt <= now) return fail("CONFLICT", "Sessions can't be cancelled once they've started.");

  const parsed = cancelSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  await db.tutoringSession.update({
    where: { id: sessionId },
    data: { status: "CANCELLED", cancelledById: actor.id, cancelReason: parsed.data.reason },
  });
  await closeLiveRooms({ sessionId }, now, provider);
  return ok(null);
}
