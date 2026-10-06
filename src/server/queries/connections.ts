import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { JOIN_CLOSES_MINUTES_AFTER } from "@/lib/live-sessions";
import { db } from "@/server/db";
import { progressSelect, summarizeCourse } from "./course-progress";
import { photoUrl } from "./teachers";

const LIVE = ["REQUESTED", "CONFIRMED"] as const;

const sessionSelect = {
  id: true,
  startsAt: true,
  endsAt: true,
  status: true,
  agenda: true,
  cancelReason: true,
  cancelledById: true,
} satisfies Prisma.TutoringSessionSelect;

/** Relationship pages also show who was in each past session's video room. */
const sessionWithAttendanceSelect = {
  ...sessionSelect,
  attendance: { select: { userId: true, joinedAt: true, leftAt: true } },
} satisfies Prisma.TutoringSessionSelect;

const messageSelect = { id: true, body: true, createdAt: true, readAt: true, senderId: true } satisfies Prisma.MessageSelect;

async function unreadByConnection(userId: string, connectionIds: string[]): Promise<Map<string, number>> {
  const rows = await db.message.groupBy({
    by: ["connectionId"],
    where: { connectionId: { in: connectionIds }, senderId: { not: userId }, readAt: null },
    _count: { _all: true },
  });
  return new Map(rows.map((r) => [r.connectionId, r._count._all]));
}

/** A student's teachers, requests and past teachers. */
export async function listStudentConnections(studentId: string, now = new Date()) {
  const connections = await db.teacherConnection.findMany({
    where: { studentId },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      status: true,
      createdAt: true,
      responseNote: true,
      topic: { select: { name: true } },
      teacher: {
        select: {
          id: true,
          name: true,
          teacherProfile: { select: { id: true, slug: true, headline: true, photo: { select: { updatedAt: true } }, topics: { take: 1, select: { topic: { select: { subject: { select: { color: true } } } } } } } },
        },
      },
      sessions: { where: { status: { in: [...LIVE] }, startsAt: { gt: now } }, orderBy: { startsAt: "asc" }, take: 1, select: sessionSelect },
    },
  });
  const unread = await unreadByConnection(studentId, connections.map((c) => c.id));
  return connections.map((c) => ({
    ...c,
    photo: c.teacher.teacherProfile ? photoUrl(c.teacher.teacherProfile) : null,
    color: c.teacher.teacherProfile?.topics[0]?.topic.subject.color,
    nextSession: c.sessions[0] ?? null,
    unread: unread.get(c.id) ?? 0,
  }));
}

export async function getStudentConnection(studentId: string, connectionId: string) {
  return db.teacherConnection.findFirst({
    where: { id: connectionId, studentId },
    select: {
      id: true,
      status: true,
      goals: true,
      responseNote: true,
      createdAt: true,
      respondedAt: true,
      endedAt: true,
      endedById: true,
      topic: { select: { name: true } },
      teacher: {
        select: {
          id: true,
          name: true,
          status: true,
          teacherProfile: {
            select: {
              id: true,
              slug: true,
              headline: true,
              meetingUrl: true,
              timeZone: true,
              sessionMinutes: true,
              photo: { select: { updatedAt: true } },
              topics: { take: 1, select: { topic: { select: { subject: { select: { color: true } } } } } },
            },
          },
        },
      },
      sessions: { orderBy: { startsAt: "asc" }, select: sessionWithAttendanceSelect },
      messages: { orderBy: { createdAt: "asc" }, take: 200, select: messageSelect },
    },
  });
}

/** A teacher's requests, current students and past students. */
export async function listTeacherConnections(teacherId: string, now = new Date()) {
  const connections = await db.teacherConnection.findMany({
    where: { teacherId },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      status: true,
      goals: true,
      createdAt: true,
      endedAt: true,
      topic: { select: { name: true } },
      student: { select: { id: true, name: true } },
      sessions: { where: { status: { in: [...LIVE] }, startsAt: { gt: now } }, orderBy: { startsAt: "asc" }, take: 1, select: sessionSelect },
    },
  });
  const unread = await unreadByConnection(teacherId, connections.map((c) => c.id));
  const rows = connections.map((c) => ({ ...c, nextSession: c.sessions[0] ?? null, unread: unread.get(c.id) ?? 0 }));
  return {
    pending: rows.filter((r) => r.status === "PENDING").sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()),
    active: rows.filter((r) => r.status === "ACTIVE"),
    past: rows.filter((r) => r.status === "DECLINED" || r.status === "ENDED"),
  };
}

export async function getTeacherConnection(teacherId: string, connectionId: string) {
  const connection = await db.teacherConnection.findFirst({
    where: { id: connectionId, teacherId },
    select: {
      id: true,
      status: true,
      goals: true,
      responseNote: true,
      createdAt: true,
      respondedAt: true,
      endedAt: true,
      endedById: true,
      topic: { select: { name: true } },
      student: { select: { id: true, name: true, email: true } },
      sessions: { orderBy: { startsAt: "asc" }, select: sessionWithAttendanceSelect },
      messages: { orderBy: { createdAt: "asc" }, take: 200, select: messageSelect },
    },
  });
  if (!connection) return null;

  // How the student is doing in this teacher's own courses.
  const enrollments = await db.enrollment.findMany({
    where: { userId: connection.student.id, course: { teacherId } },
    select: { completedAt: true, course: { select: { id: true, title: true, ...progressSelect(connection.student.id) } } },
  });
  const completed = await db.lessonProgress.findMany({
    where: { userId: connection.student.id, lesson: { course: { teacherId } } },
    select: { lessonId: true },
  });
  const done = completed.map((c) => c.lessonId);
  const courses = enrollments.map((e) => ({ id: e.course.id, title: e.course.title, completedAt: e.completedAt, summary: summarizeCourse(e.course, done) }));
  return { connection, courses };
}

export async function countUnreadMessages(userId: string): Promise<number> {
  return db.message.count({
    where: { senderId: { not: userId }, readAt: null, connection: { OR: [{ studentId: userId }, { teacherId: userId }] } },
  });
}

export async function countPendingRequests(teacherId: string): Promise<number> {
  return db.teacherConnection.count({ where: { teacherId, status: "PENDING" } });
}

/**
 * Upcoming sessions for a student or teacher, soonest first. With video rooms on,
 * a confirmed session stays listed while its room is still open after the end, so
 * people can get back in.
 */
export async function listUpcomingSessions(
  userId: string,
  as: "STUDENT" | "TEACHER",
  now = new Date(),
  { limit = 5, includeOpenRooms = false }: { limit?: number; includeOpenRooms?: boolean } = {},
) {
  const graceStart = new Date(now.getTime() - JOIN_CLOSES_MINUTES_AFTER * 60_000);
  const sessions = await db.tutoringSession.findMany({
    where: {
      status: { in: [...LIVE] },
      OR: [{ endsAt: { gt: now } }, ...(includeOpenRooms ? [{ status: "CONFIRMED" as const, endsAt: { gt: graceStart } }] : [])],
      connection: as === "STUDENT" ? { studentId: userId, status: { in: ["ACTIVE", "PENDING"] } } : { teacherId: userId, status: { in: ["ACTIVE", "PENDING"] } },
    },
    orderBy: { startsAt: "asc" },
    take: limit,
    select: {
      ...sessionSelect,
      connection: {
        select: {
          id: true,
          status: true,
          student: { select: { name: true } },
          teacher: { select: { name: true, teacherProfile: { select: { meetingUrl: true } } } },
        },
      },
    },
  });
  return sessions.map((s) => ({
    ...s,
    otherName: as === "STUDENT" ? s.connection.teacher.name : s.connection.student.name,
    meetingUrl: s.status === "CONFIRMED" ? (s.connection.teacher.teacherProfile?.meetingUrl ?? null) : null,
  }));
}
