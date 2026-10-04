import "server-only";
import { randomUUID } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import { JOIN_CLOSES_MINUTES_AFTER, JOIN_OPENS_MINUTES_BEFORE, joinWindow, liveSessionIdSchema, roomNameFor, roomState, sessionIdFromRoom } from "@/lib/live-sessions";
import { db } from "@/server/db";
import { getVideoProvider, type VideoEvent, type VideoProvider } from "@/server/video";
import { type Actor, fail, forbidden, isActive, notFound, ok, type ServiceResult } from "./result";
import { markThreadRead, sendMessage } from "./teacher-social";

const MINUTE = 60_000;

/** The session and which side of it the actor is on, or null for anyone who isn't one of its two people. */
async function loadParty(actor: Actor, sessionId: unknown) {
  const id = liveSessionIdSchema.safeParse(sessionId);
  if (!id.success) return null;
  const session = await db.tutoringSession.findUnique({
    where: { id: id.data },
    select: { id: true, startsAt: true, endsAt: true, status: true, connection: { select: { id: true, studentId: true, teacherId: true, status: true } } },
  });
  const role = session?.connection.studentId === actor.id ? ("student" as const) : session?.connection.teacherId === actor.id ? ("teacher" as const) : null;
  return session && role ? { session, role } : null;
}

/**
 * Let a student or teacher into their session's video room. Only the two people
 * in the session get a token, only while it's confirmed and its room is open.
 */
export async function joinLiveSession(
  actor: Actor,
  sessionId: string,
  now = new Date(),
  provider: VideoProvider | null = getVideoProvider(),
): Promise<ServiceResult<{ token: string; serverUrl: string; closesInMs: number }>> {
  if (!isActive(actor)) return forbidden();
  const party = await loadParty(actor, sessionId);
  if (!party) return notFound("That session");
  const { session, role } = party;
  if (!provider) return fail("CONFLICT", "Live video isn't set up yet. Use the meeting link instead.");
  if (session.connection.status !== "ACTIVE") return fail("CONFLICT", "This room is closed because you're no longer working together.");

  switch (roomState(session, now)) {
    case "cancelled":
      return fail("CONFLICT", "This session was cancelled.");
    case "unconfirmed":
      return fail("CONFLICT", "This session hasn't been confirmed yet.");
    case "upcoming":
      return fail("CONFLICT", `The room opens ${JOIN_OPENS_MINUTES_BEFORE} minutes before the session starts.`);
    case "ended":
      return fail("CONFLICT", "This session has finished.");
  }

  const token = await provider.createJoinToken({ room: roomNameFor(session.id), identity: actor.id, name: actor.name, role });
  // From the server's clock, so the page closes on time whatever the device's clock says.
  const closesInMs = joinWindow(session).closesAt.getTime() - now.getTime();
  return ok({ token, serverUrl: provider.serverUrl, closesInMs });
}

/** Whose rooms to close: one session's, one partnership's, or everyone one person is in. */
export type RoomScope = { sessionId: string } | { connectionId: string } | { userId: string };

function scopeWhere(scope: RoomScope): Prisma.TutoringSessionWhereInput {
  if ("sessionId" in scope) return { id: scope.sessionId };
  if ("connectionId" in scope) return { connectionId: scope.connectionId };
  return { connection: { OR: [{ studentId: scope.userId }, { teacherId: scope.userId }] } };
}

function within<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([promise, new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`No answer within ${ms} ms`)), ms))]);
}

/**
 * Close the video rooms in scope that could be in use now, so nobody stays in a
 * call after its session, partnership or account has ended. Best effort, and
 * quick to give up: a video service outage must not hold up or undo the change
 * that caused it, so failures are logged rather than thrown.
 */
export async function closeLiveRooms(
  scope: RoomScope,
  now = new Date(),
  provider: VideoProvider | null = getVideoProvider(),
  timeoutMs = 5_000,
): Promise<void> {
  if (!provider) return;
  try {
    const open = await db.tutoringSession.findMany({
      where: {
        AND: [
          scopeWhere(scope),
          { startsAt: { lte: new Date(now.getTime() + JOIN_OPENS_MINUTES_BEFORE * MINUTE) } },
          { endsAt: { gt: new Date(now.getTime() - JOIN_CLOSES_MINUTES_AFTER * MINUTE) } },
        ],
      },
      select: { id: true },
    });
    const results = await Promise.allSettled(open.map((s) => within(provider.closeRoom(roomNameFor(s.id)), timeoutMs)));
    results.forEach((result, i) => {
      if (result.status === "rejected") console.error(`Couldn't close the video room for session ${open[i].id}`, result.reason);
    });
  } catch (error) {
    console.error("Couldn't look up video rooms to close", error);
  }
}

/**
 * Record who was in a session's room, from the video service's signed webhooks.
 * Each connection is one row keyed by its participant id. Whatever order events
 * arrive in, and however often, the row keeps the earliest join and latest leave.
 */
async function recordVideoEvent(event: VideoEvent): Promise<boolean> {
  if (event.kind === "ignored") return false;
  const sessionId = sessionIdFromRoom(event.room);
  if (!sessionId) return false;
  const session = await db.tutoringSession.findUnique({
    where: { id: sessionId },
    select: { connection: { select: { studentId: true, teacherId: true } } },
  });
  if (!session || (session.connection.studentId !== event.identity && session.connection.teacherId !== event.identity)) return false;

  // A "left" that arrives first opens and closes the stay at the same moment; the "joined" moves its start back.
  const leftAt = event.kind === "left" ? event.at : null;
  await db.$executeRaw`
    INSERT INTO "SessionAttendance" ("id", "sessionId", "userId", "participantSid", "joinedAt", "leftAt")
    VALUES (${randomUUID()}, ${sessionId}, ${event.identity}, ${event.participantSid}, ${event.at}, ${leftAt})
    ON CONFLICT ("participantSid") DO UPDATE SET
      "joinedAt" = LEAST("SessionAttendance"."joinedAt", EXCLUDED."joinedAt"),
      "leftAt" = GREATEST("SessionAttendance"."leftAt", EXCLUDED."leftAt")
    WHERE "SessionAttendance"."sessionId" = EXCLUDED."sessionId" AND "SessionAttendance"."userId" = EXCLUDED."userId"`;
  return true;
}

/** The webhook endpoint's work: verify the signature, then record the event. */
export async function receiveVideoWebhook(
  body: string,
  authorization: string | null,
  provider: VideoProvider | null = getVideoProvider(),
): Promise<ServiceResult<{ recorded: boolean }>> {
  if (!provider) return notFound("Live video");
  const event = await provider.verifyWebhook(body, authorization);
  if (!event) return forbidden("That webhook isn't signed with our key.");
  return ok({ recorded: await recordVideoEvent(event) });
}

/**
 * The in-call chat is the pair's ordinary message thread, reached through the
 * session. Opening it can mark the other person's messages read.
 */
export async function loadCallMessages(actor: Actor, sessionId: string, options: { markRead: boolean }): Promise<ServiceResult<{ connectionId: string }>> {
  const party = await loadParty(actor, sessionId);
  if (!party) return notFound("That session");
  const connectionId = party.session.connection.id;
  if (options.markRead === true) {
    const read = await markThreadRead(actor, connectionId);
    if (!read.ok) return read;
  }
  return ok({ connectionId });
}

/** Send a chat message from the call. Same checks and limits as any message in the thread. */
export async function sendCallMessage(actor: Actor, sessionId: string, input: unknown): Promise<ServiceResult<{ connectionId: string }>> {
  const party = await loadParty(actor, sessionId);
  if (!party) return notFound("That session");
  const connectionId = party.session.connection.id;
  const sent = await sendMessage(actor, connectionId, input);
  return sent.ok ? ok({ connectionId }) : sent;
}
