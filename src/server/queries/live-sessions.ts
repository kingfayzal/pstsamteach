import "server-only";
import { type CallMessage, liveSessionIdSchema, roomState } from "@/lib/live-sessions";
import { db } from "@/server/db";

/** A session as one of its two people sees it in the video room, or null for anyone else. */
export async function getLiveSession(viewerId: string, sessionId: string, now = new Date()) {
  const id = liveSessionIdSchema.safeParse(sessionId);
  if (!id.success) return null;
  const session = await db.tutoringSession.findUnique({
    where: { id: id.data },
    select: {
      id: true,
      startsAt: true,
      endsAt: true,
      status: true,
      agenda: true,
      connection: {
        select: {
          id: true,
          status: true,
          studentId: true,
          teacherId: true,
          student: { select: { name: true } },
          teacher: { select: { name: true, teacherProfile: { select: { meetingUrl: true } } } },
        },
      },
    },
  });
  if (!session) return null;
  const { connection } = session;
  const role = connection.studentId === viewerId ? "student" : connection.teacherId === viewerId ? "teacher" : null;
  if (!role) return null;
  const state = roomState(session, now);
  // The teacher's personal meeting room is only for a live partnership's session that is ahead or under way.
  const backupOffered = connection.status === "ACTIVE" && (state === "upcoming" || state === "open");

  return {
    id: session.id,
    startsAt: session.startsAt,
    endsAt: session.endsAt,
    status: session.status,
    agenda: session.agenda,
    role,
    otherName: role === "student" ? connection.teacher.name : connection.student.name,
    connectionId: connection.id,
    partnershipActive: connection.status === "ACTIVE",
    /** The teacher's own meeting link, offered in the room in case the video won't connect. */
    backupUrl: backupOffered ? (connection.teacher.teacherProfile?.meetingUrl ?? null) : null,
    backHref: role === "student" ? `/learn/teachers/${connection.id}` : `/teach/students/${connection.id}`,
  } as const;
}

export type LiveSession = NonNullable<Awaited<ReturnType<typeof getLiveSession>>>;

/** The pair's message thread for the in-call chat panel: the latest messages, oldest first. */
export async function listCallMessages(viewerId: string, connectionId: string, limit = 100): Promise<CallMessage[]> {
  const messages = await db.message.findMany({
    where: { connectionId, connection: { OR: [{ studentId: viewerId }, { teacherId: viewerId }] } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit,
    select: { id: true, body: true, createdAt: true, senderId: true },
  });
  return messages.reverse();
}
