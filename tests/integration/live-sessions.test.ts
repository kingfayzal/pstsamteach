import { createHash, randomBytes } from "node:crypto";
import { AccessToken, TokenVerifier } from "livekit-server-sdk";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/server/db";
import { suspendUser } from "@/server/services/admin";
import { endConnection, requestTeacher, respondToRequest } from "@/server/services/connections";
import { closeLiveRooms, joinLiveSession, loadCallMessages, receiveVideoWebhook, sendCallMessage } from "@/server/services/live-sessions";
import { listUpcomingSessions } from "@/server/queries/connections";
import { getLiveSession, listCallMessages } from "@/server/queries/live-sessions";
import { sendMessage } from "@/server/services/teacher-social";
import { bookSession, cancelSession } from "@/server/services/tutoring";
import type { VideoProvider } from "@/server/video";
import { createLiveKitProvider } from "@/server/video/livekit";
import { makeAdmin, makeStudent, makeSubject, makeTeacher, makeTeacherProfile, makeTopic, makeUser, resetDb } from "./factories";

beforeEach(resetDb);

const API_KEY = "test-key";
const API_SECRET = randomBytes(32).toString("hex");
const provider = createLiveKitProvider({ url: "ws://localhost:7880", httpUrl: "http://localhost:7880", apiKey: API_KEY, apiSecret: API_SECRET });

/** The real provider for tokens and webhooks, but recording rooms it's asked to close instead of calling LiveKit. */
function recordingProvider(): { closed: string[]; provider: VideoProvider } {
  const closed: string[] = [];
  return { closed, provider: { ...provider, closeRoom: async (room) => void closed.push(room) } };
}

// Sunday 27 Sept 2026, midday UTC. The default profile teaches Monday 18:00–20:00 Lagos (17:00–19:00 UTC).
const BOOKED_AT = new Date("2026-09-27T12:00:00Z");
const START = new Date("2026-09-28T17:00:00.000Z");
const MINUTE = 60_000;
const at = (minutesFromStart: number) => new Date(START.getTime() + minutesFromStart * MINUTE);
const GOALS = "I'm preparing for my licensing exam and keep getting dosage questions wrong.";

/** A student and teacher working together, with one confirmed 60-minute session at START. */
async function bookedSession() {
  const subject = await makeSubject({ name: `Nursing ${Math.random()}` });
  const topic = await makeTopic(subject.id, "Dosage calculations");
  const teacher = await makeTeacher();
  await makeTeacherProfile(teacher.id, { topicIds: [topic.id] });
  const student = await makeStudent();
  const request = await requestTeacher(student, teacher.id, { goals: GOALS }, BOOKED_AT);
  if (!request.ok) throw new Error(request.message);
  await respondToRequest(teacher, request.data.connectionId, true, {}, BOOKED_AT);
  const booked = await bookSession(student, request.data.connectionId, { slotStart: START.toISOString() }, BOOKED_AT);
  if (!booked.ok) throw new Error(booked.message);
  return { teacher, student, connectionId: request.data.connectionId, sessionId: booked.data.sessionId };
}

async function claims(token: string) {
  return new TokenVerifier(API_KEY, API_SECRET).verify(token);
}

describe("joinLiveSession", () => {
  it("gives each person a token for this session's room only", async () => {
    const { teacher, student, sessionId } = await bookedSession();

    const forStudent = await joinLiveSession(student, sessionId, at(-5), provider);
    if (!forStudent.ok) throw new Error(forStudent.message);
    expect(forStudent.data.serverUrl).toBe("ws://localhost:7880");
    // Worked out on the server, so the page can close on time whatever the phone's clock says.
    expect(forStudent.data.closesInMs).toBe((60 + 15 + 5) * MINUTE);
    const studentClaims = await claims(forStudent.data.token);
    expect(studentClaims.sub).toBe(student.id);
    expect(studentClaims.name).toBe(student.name);
    expect(studentClaims.attributes).toEqual({ role: "student" });
    expect(studentClaims.video).toMatchObject({
      room: `session-${sessionId}`,
      roomJoin: true,
      canSubscribe: true,
      canPublishData: true,
      canPublishSources: ["camera", "microphone", "screen_share", "screen_share_audio"],
    });
    // Never room admin powers: no creating, listing, recording or managing rooms.
    expect(studentClaims.video?.roomAdmin).toBeFalsy();
    expect(studentClaims.video?.roomCreate).toBeFalsy();
    expect(studentClaims.video?.roomList).toBeFalsy();
    expect(studentClaims.video?.roomRecord).toBeFalsy();
    // Short-lived: only needed to connect; LiveKit refreshes it for people already in the room.
    expect(studentClaims.exp! - studentClaims.nbf!).toBeLessThanOrEqual(10 * 60);

    const forTeacher = await joinLiveSession(teacher, sessionId, at(30), provider);
    if (!forTeacher.ok) throw new Error(forTeacher.message);
    const teacherClaims = await claims(forTeacher.data.token);
    expect(teacherClaims.sub).toBe(teacher.id);
    expect(teacherClaims.attributes).toEqual({ role: "teacher" });
    expect(teacherClaims.video?.room).toBe(`session-${sessionId}`);
  });

  it("hides the session from everyone who isn't in it", async () => {
    const { sessionId } = await bookedSession();
    const other = await bookedSession();
    for (const outsider of [await makeStudent(), await makeTeacher(), await makeUser({ role: "ADMIN" }), other.student, other.teacher]) {
      expect(await joinLiveSession(outsider, sessionId, at(0), provider)).toMatchObject({ ok: false, code: "NOT_FOUND" });
    }
    expect(await joinLiveSession(other.student, "no-such-session", at(0), provider)).toMatchObject({ ok: false, code: "NOT_FOUND" });
  });

  it("only opens shortly before the start and until a little after the end", async () => {
    const { student, sessionId } = await bookedSession();
    expect(await joinLiveSession(student, sessionId, at(-11), provider)).toMatchObject({ ok: false, code: "CONFLICT", message: expect.stringMatching(/opens 10 minutes before/) });
    expect((await joinLiveSession(student, sessionId, at(-10), provider)).ok).toBe(true);
    expect((await joinLiveSession(student, sessionId, at(60 + 14), provider)).ok).toBe(true);
    expect(await joinLiveSession(student, sessionId, at(60 + 15), provider)).toMatchObject({ ok: false, code: "CONFLICT", message: expect.stringMatching(/finished/) });
  });

  it("refuses cancelled sessions and ended partnerships", async () => {
    const cancelled = await bookedSession();
    await db.tutoringSession.update({ where: { id: cancelled.sessionId }, data: { status: "CANCELLED" } });
    expect(await joinLiveSession(cancelled.student, cancelled.sessionId, at(0), provider)).toMatchObject({ ok: false, code: "CONFLICT" });

    const ended = await bookedSession();
    await db.teacherConnection.update({ where: { id: ended.connectionId }, data: { status: "ENDED" } });
    expect(await joinLiveSession(ended.teacher, ended.sessionId, at(0), provider)).toMatchObject({ ok: false, code: "CONFLICT" });
  });

  it("refuses suspended accounts", async () => {
    const { student, sessionId } = await bookedSession();
    expect(await joinLiveSession({ ...student, status: "SUSPENDED" }, sessionId, at(0), provider)).toMatchObject({ ok: false, code: "FORBIDDEN" });
  });

  it("explains when live video isn't set up", async () => {
    const { student, sessionId } = await bookedSession();
    expect(await joinLiveSession(student, sessionId, at(0), null)).toMatchObject({ ok: false, code: "CONFLICT", message: expect.stringMatching(/isn't set up/) });
  });
});

/** A webhook signed the way LiveKit signs them: a JWT carrying the body's SHA-256. */
async function webhook(payload: object, secret = API_SECRET) {
  const body = JSON.stringify(payload);
  const token = new AccessToken(API_KEY, secret);
  token.sha256 = createHash("sha256").update(body).digest("base64");
  return { body, authorization: await token.toJwt() };
}

const epoch = (date: Date) => String(Math.floor(date.getTime() / 1000));

function participantEvent(event: "participant_joined" | "participant_left", sessionId: string, identity: string, sid: string, when: Date) {
  return {
    id: `EV_${randomBytes(6).toString("hex")}`,
    event,
    createdAt: epoch(when),
    room: { sid: "RM_test", name: `session-${sessionId}` },
    participant: { sid, identity, name: "Someone", joinedAt: epoch(event === "participant_joined" ? when : at(0)) },
  };
}

async function stays(sessionId: string) {
  return db.sessionAttendance.findMany({ where: { sessionId }, orderBy: { joinedAt: "asc" }, select: { userId: true, participantSid: true, joinedAt: true, leftAt: true } });
}

describe("receiveVideoWebhook", () => {
  it("records when each person joins and leaves the room", async () => {
    const { student, teacher, sessionId } = await bookedSession();
    for (const payload of [
      participantEvent("participant_joined", sessionId, teacher.id, "PA_teacher", at(-2)),
      participantEvent("participant_joined", sessionId, student.id, "PA_student", at(1)),
      participantEvent("participant_left", sessionId, student.id, "PA_student", at(58)),
    ]) {
      const { body, authorization } = await webhook(payload);
      expect(await receiveVideoWebhook(body, authorization, provider)).toEqual({ ok: true, data: { recorded: true } });
    }
    expect(await stays(sessionId)).toEqual([
      { userId: teacher.id, participantSid: "PA_teacher", joinedAt: at(-2), leftAt: null },
      { userId: student.id, participantSid: "PA_student", joinedAt: at(1), leftAt: at(58) },
    ]);
  });

  it("copes with retries and events that arrive out of order", async () => {
    const { student, sessionId } = await bookedSession();
    const left = await webhook(participantEvent("participant_left", sessionId, student.id, "PA_1", at(30)));
    const joined = await webhook(participantEvent("participant_joined", sessionId, student.id, "PA_1", at(5)));
    for (const { body, authorization } of [left, joined, joined, left]) {
      expect((await receiveVideoWebhook(body, authorization, provider)).ok).toBe(true);
    }
    expect(await stays(sessionId)).toEqual([{ userId: student.id, participantSid: "PA_1", joinedAt: at(5), leftAt: at(30) }]);
  });

  it("rejects anything not signed with our key", async () => {
    const { student, sessionId } = await bookedSession();
    const payload = participantEvent("participant_joined", sessionId, student.id, "PA_1", at(0));
    const forged = await webhook(payload, randomBytes(32).toString("hex"));
    expect(await receiveVideoWebhook(forged.body, forged.authorization, provider)).toMatchObject({ ok: false, code: "FORBIDDEN" });

    const real = await webhook(payload);
    const tampered = real.body.replace(student.id, "someone-else");
    expect(await receiveVideoWebhook(tampered, real.authorization, provider)).toMatchObject({ ok: false, code: "FORBIDDEN" });
    expect(await receiveVideoWebhook(real.body, null, provider)).toMatchObject({ ok: false, code: "FORBIDDEN" });
    expect(await receiveVideoWebhook("not json", real.authorization, provider)).toMatchObject({ ok: false, code: "FORBIDDEN" });
    expect(await stays(sessionId)).toEqual([]);
  });

  it("ignores rooms, sessions and people that aren't ours", async () => {
    const { sessionId } = await bookedSession();
    const stranger = await makeStudent();
    const payloads = [
      participantEvent("participant_joined", sessionId, stranger.id, "PA_1", at(0)),
      participantEvent("participant_joined", "missing-session", stranger.id, "PA_2", at(0)),
      { ...participantEvent("participant_joined", sessionId, stranger.id, "PA_3", at(0)), room: { name: "some-other-room" } },
      { id: "EV_room", event: "room_started", createdAt: epoch(at(0)), room: { name: `session-${sessionId}` } },
    ];
    for (const payload of payloads) {
      const { body, authorization } = await webhook(payload);
      expect(await receiveVideoWebhook(body, authorization, provider)).toEqual({ ok: true, data: { recorded: false } });
    }
    expect(await db.sessionAttendance.count()).toBe(0);
  });

  it("is switched off when live video isn't set up", async () => {
    const { body, authorization } = await webhook({ id: "EV_1", event: "room_started" });
    expect(await receiveVideoWebhook(body, authorization, null)).toMatchObject({ ok: false, code: "NOT_FOUND" });
  });
});

describe("getLiveSession", () => {
  it("shows each person the session from their side, with the teacher's link as a backup", async () => {
    const { teacher, student, connectionId, sessionId } = await bookedSession();

    expect(await getLiveSession(student.id, sessionId, at(-30))).toMatchObject({
      id: sessionId,
      startsAt: START,
      endsAt: at(60),
      status: "CONFIRMED",
      role: "student",
      otherName: teacher.name,
      connectionId,
      partnershipActive: true,
      backupUrl: "https://meet.example.com/room",
      backHref: `/learn/teachers/${connectionId}`,
    });
    expect(await getLiveSession(teacher.id, sessionId)).toMatchObject({ role: "teacher", otherName: student.name, backHref: `/teach/students/${connectionId}` });
  });

  it("is invisible to everyone else", async () => {
    const { sessionId } = await bookedSession();
    for (const outsider of [await makeStudent(), await makeTeacher(), await makeUser({ role: "ADMIN" })]) {
      expect(await getLiveSession(outsider.id, sessionId)).toBeNull();
    }
    expect(await getLiveSession((await makeStudent()).id, "no-such-session")).toBeNull();
  });

  it("only offers the teacher's backup link while the session is still ahead or running", async () => {
    const { student, connectionId, sessionId } = await bookedSession();
    expect(await getLiveSession(student.id, sessionId, at(30))).toMatchObject({ backupUrl: "https://meet.example.com/room" });
    // Finished: the teacher's personal meeting room isn't handed out with old sessions.
    expect(await getLiveSession(student.id, sessionId, at(60 + 15))).toMatchObject({ backupUrl: null });

    await db.teacherConnection.update({ where: { id: connectionId }, data: { status: "ENDED" } });
    expect(await getLiveSession(student.id, sessionId, at(30))).toMatchObject({ partnershipActive: false, backupUrl: null });

    await db.tutoringSession.update({ where: { id: sessionId }, data: { status: "CANCELLED" } });
    expect(await getLiveSession(student.id, sessionId, at(-30))).toMatchObject({ status: "CANCELLED", backupUrl: null });
  });

  it("treats malformed ids as not found", async () => {
    const { student } = await bookedSession();
    expect(await getLiveSession(student.id, "a/b")).toBeNull();
  });
});

describe("listCallMessages", () => {
  it("returns the pair's thread, oldest first, to the two of them only", async () => {
    const { teacher, student, connectionId } = await bookedSession();
    await sendMessage(student, connectionId, { body: "Can you hear me?" });
    await sendMessage(teacher, connectionId, { body: "Yes, loud and clear." });

    const forStudent = await listCallMessages(student.id, connectionId);
    expect(forStudent.map((m) => [m.senderId, m.body])).toEqual([
      [student.id, "Can you hear me?"],
      [teacher.id, "Yes, loud and clear."],
    ]);
    expect(await listCallMessages(teacher.id, connectionId)).toHaveLength(2);
    expect(await listCallMessages((await makeStudent()).id, connectionId)).toEqual([]);
  });

  it("keeps only the most recent messages", async () => {
    const { student, connectionId } = await bookedSession();
    for (let i = 1; i <= 5; i++) await sendMessage(student, connectionId, { body: `Message ${i}` });
    expect((await listCallMessages(student.id, connectionId, 3)).map((m) => m.body)).toEqual(["Message 3", "Message 4", "Message 5"]);
  });
});

describe("joinLiveSession input", () => {
  it("treats malformed ids as not found and refuses accounts that aren't active", async () => {
    const { student, sessionId } = await bookedSession();
    for (const id of ["a/b", "", "x".repeat(65), 42 as unknown as string]) {
      expect(await joinLiveSession(student, id, at(0), provider)).toMatchObject({ ok: false, code: "NOT_FOUND" });
    }
    expect(await joinLiveSession({ ...student, status: "PENDING" }, sessionId, at(0), provider)).toMatchObject({ ok: false, code: "FORBIDDEN" });
  });
});

describe("receiveVideoWebhook edge cases", () => {
  async function deliver(payload: object) {
    const { body, authorization } = await webhook(payload);
    return receiveVideoWebhook(body, authorization, provider);
  }

  it("never moves a recorded leave earlier when a stale or duplicate event arrives", async () => {
    const { student, sessionId } = await bookedSession();
    await deliver(participantEvent("participant_joined", sessionId, student.id, "PA_1", at(5)));
    await deliver(participantEvent("participant_left", sessionId, student.id, "PA_1", at(30)));
    await deliver({ ...participantEvent("participant_left", sessionId, student.id, "PA_1", at(10)), event: "participant_connection_aborted" });
    await deliver(participantEvent("participant_joined", sessionId, student.id, "PA_1", at(8)));
    expect(await stays(sessionId)).toEqual([{ userId: student.id, participantSid: "PA_1", joinedAt: at(5), leftAt: at(30) }]);
  });

  it("closes a stay when the connection is aborted", async () => {
    const { teacher, sessionId } = await bookedSession();
    await deliver(participantEvent("participant_joined", sessionId, teacher.id, "PA_t", at(0)));
    await deliver({ ...participantEvent("participant_left", sessionId, teacher.id, "PA_t", at(1)), event: "participant_connection_aborted" });
    expect(await stays(sessionId)).toEqual([{ userId: teacher.id, participantSid: "PA_t", joinedAt: at(0), leftAt: at(1) }]);
  });

  it("keeps each reconnect as its own stay", async () => {
    const { student, sessionId } = await bookedSession();
    await deliver(participantEvent("participant_joined", sessionId, student.id, "PA_a", at(0)));
    await deliver(participantEvent("participant_joined", sessionId, student.id, "PA_b", at(20)));
    await deliver(participantEvent("participant_left", sessionId, student.id, "PA_a", at(21)));
    expect((await stays(sessionId)).map((s) => [s.participantSid, s.leftAt])).toEqual([
      ["PA_a", at(21)],
      ["PA_b", null],
    ]);
  });

  it("falls back to the event time when LiveKit doesn't say when someone joined", async () => {
    const { student, sessionId } = await bookedSession();
    const payload = participantEvent("participant_joined", sessionId, student.id, "PA_1", at(2));
    await deliver({ ...payload, participant: { ...payload.participant, joinedAt: "0" } });
    expect(await stays(sessionId)).toEqual([{ userId: student.id, participantSid: "PA_1", joinedAt: at(2), leftAt: null }]);
  });

  it("ignores participant events without an id", async () => {
    const { student, sessionId } = await bookedSession();
    const payload = participantEvent("participant_joined", sessionId, student.id, "PA_1", at(2));
    expect(await deliver({ ...payload, participant: { identity: student.id } })).toEqual({ ok: true, data: { recorded: false } });
  });
});

describe("closing live rooms", () => {
  it("gives up on a video service that doesn't answer, so the change behind it still completes quickly", async () => {
    const { student, sessionId } = await bookedSession();
    const hanging: VideoProvider = { ...provider, closeRoom: () => new Promise(() => undefined) };
    const quiet = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const started = Date.now();
    await closeLiveRooms({ sessionId }, at(0), hanging, 50);
    expect(Date.now() - started).toBeLessThan(2_000);
    expect(quiet).toHaveBeenCalledOnce();
    quiet.mockRestore();
    expect(student.id).toBeTruthy();
  });

  it("only closes rooms for the session, partnership or person it's given", async () => {
    const one = await bookedSession();
    const other = await bookedSession();
    const recording = recordingProvider();
    await closeLiveRooms({ connectionId: one.connectionId }, at(0), recording.provider);
    await closeLiveRooms({ userId: other.student.id }, at(0), recording.provider);
    expect(recording.closed).toEqual([`session-${one.sessionId}`, `session-${other.sessionId}`]);
  });

  it("closes the room when a session that's about to start is cancelled", async () => {
    const { student, sessionId } = await bookedSession();
    const recording = recordingProvider();
    expect((await cancelSession(student, sessionId, { reason: "Unwell" }, at(-5), recording.provider)).ok).toBe(true);
    expect(recording.closed).toEqual([`session-${sessionId}`]);
  });

  it("closes the room of a session in progress when the partnership ends", async () => {
    const { teacher, connectionId, sessionId } = await bookedSession();
    const recording = recordingProvider();
    expect((await endConnection(teacher, connectionId, at(20), recording.provider)).ok).toBe(true);
    expect(recording.closed).toEqual([`session-${sessionId}`]);
  });

  it("closes a suspended person's open rooms, and only those", async () => {
    const { teacher, sessionId } = await bookedSession();
    const later = await bookedSession();
    const recording = recordingProvider();
    expect((await suspendUser(await makeAdmin(), teacher.id, at(20), recording.provider)).ok).toBe(true);
    expect(recording.closed).toEqual([`session-${sessionId}`]);
    expect(recording.closed).not.toContain(`session-${later.sessionId}`);
  });

  it("leaves rooms alone when nothing is open", async () => {
    const { teacher, connectionId } = await bookedSession();
    const recording = recordingProvider();
    await endConnection(teacher, connectionId, BOOKED_AT, recording.provider);
    expect(recording.closed).toEqual([]);
  });

  it("doesn't let a video service outage block cancelling", async () => {
    const { student, sessionId } = await bookedSession();
    const failing: VideoProvider = { ...provider, closeRoom: async () => Promise.reject(new Error("LiveKit is down")) };
    const quiet = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect((await cancelSession(student, sessionId, {}, at(-5), failing)).ok).toBe(true);
    expect(quiet).toHaveBeenCalledOnce();
    quiet.mockRestore();
  });
});

describe("in-call chat", () => {
  it("sends into the pair's own message thread and marks it read for whoever opens the chat", async () => {
    const { teacher, student, connectionId, sessionId } = await bookedSession();
    expect(await sendCallMessage(student, sessionId, { body: "Can you see my working?" })).toEqual({ ok: true, data: { connectionId } });
    expect((await listCallMessages(teacher.id, connectionId)).map((m) => [m.senderId, m.body])).toEqual([[student.id, "Can you see my working?"]]);

    expect(await loadCallMessages(teacher, sessionId, { markRead: false })).toEqual({ ok: true, data: { connectionId } });
    expect(await db.message.count({ where: { readAt: null } })).toBe(1);
    expect(await loadCallMessages(teacher, sessionId, { markRead: true })).toEqual({ ok: true, data: { connectionId } });
    expect(await db.message.count({ where: { readAt: null } })).toBe(0);
  });

  it("is closed to everyone else and validates messages", async () => {
    const { student, sessionId } = await bookedSession();
    expect(await sendCallMessage(await makeStudent(), sessionId, { body: "Hello" })).toMatchObject({ ok: false, code: "NOT_FOUND" });
    expect(await loadCallMessages(await makeTeacher(), sessionId, { markRead: false })).toMatchObject({ ok: false, code: "NOT_FOUND" });
    expect(await sendCallMessage(student, "a/b", { body: "Hello" })).toMatchObject({ ok: false, code: "NOT_FOUND" });
    expect(await sendCallMessage(student, sessionId, { body: "   " })).toMatchObject({ ok: false, code: "INVALID" });
  });
});

describe("dashboards during the grace period", () => {
  it("keep listing a session while its room is still open after the end", async () => {
    const { student, sessionId } = await bookedSession();
    const live = { includeOpenRooms: true };
    expect((await listUpcomingSessions(student.id, "STUDENT", at(60 + 10), live)).map((s) => s.id)).toEqual([sessionId]);
    expect(await listUpcomingSessions(student.id, "STUDENT", at(60 + 15), live)).toEqual([]);
  });

  it("drop sessions at their end when there are no video rooms, and never keep unconfirmed ones", async () => {
    const { student, sessionId } = await bookedSession();
    expect(await listUpcomingSessions(student.id, "STUDENT", at(60 + 5))).toEqual([]);
    await db.tutoringSession.update({ where: { id: sessionId }, data: { status: "REQUESTED" } });
    expect(await listUpcomingSessions(student.id, "STUDENT", at(60 + 5), { includeOpenRooms: true })).toEqual([]);
  });
});
