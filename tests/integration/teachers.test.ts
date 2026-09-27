import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { captureTimeZone, setTimeZone } from "@/server/services/accounts";
import { endConnection, MAX_PENDING_REQUESTS, requestTeacher, respondToRequest } from "@/server/services/connections";
import {
  ensureTeacherProfile,
  removeTeacherPhoto,
  setProfileHidden,
  setTeacherAvailability,
  updateTeacherProfile,
  uploadTeacherPhoto,
} from "@/server/services/teacher-profiles";
import { markThreadRead, saveReview, sendMessage, setReviewHidden, toggleSavedTeacher } from "@/server/services/teacher-social";
import { createTopic, deleteTopic, renameTopic } from "@/server/services/topics";
import { bookSession, cancelSession, MAX_UPCOMING_SESSIONS } from "@/server/services/tutoring";
import { makeAdmin, makeStudent, makeSubject, makeTeacher, makeTeacherProfile, makeTopic, makeUser, resetDb } from "./factories";

beforeEach(resetDb);

// Sunday 27 Sept 2026, midday UTC. The default profile teaches Monday 18:00–20:00 Lagos (17:00–19:00 UTC).
const NOW = new Date("2026-09-27T12:00:00Z");
const MONDAY_5PM = "2026-09-28T17:00:00.000Z";
const MONDAY_6PM = "2026-09-28T18:00:00.000Z";
const GOALS = "I'm preparing for my licensing exam and keep getting dosage questions wrong.";

async function listedTeacher(spec: Parameters<typeof makeTeacherProfile>[1] = {}) {
  const subject = await makeSubject({ name: `Nursing ${Math.random()}` });
  const topic = await makeTopic(subject.id, "Dosage calculations");
  const teacher = await makeTeacher();
  const profile = await makeTeacherProfile(teacher.id, { topicIds: [topic.id], ...spec });
  return { subject, topic, teacher, profile };
}

async function activePair() {
  const setup = await listedTeacher();
  const student = await makeStudent();
  const request = await requestTeacher(student, setup.teacher.id, { goals: GOALS }, NOW);
  if (!request.ok) throw new Error(request.message);
  await respondToRequest(setup.teacher, request.data.connectionId, true, {}, NOW);
  return { ...setup, student, connectionId: request.data.connectionId };
}

describe("teacher profiles", () => {
  it("creates a profile on first use with a slug and the teacher's zone", async () => {
    const teacher = await makeTeacher();
    await db.user.update({ where: { id: teacher.id }, data: { timeZone: "Europe/London" } });
    const first = await ensureTeacherProfile(teacher);
    const again = await ensureTeacherProfile(teacher);
    expect(first.ok && again.ok && first.data.id === again.data.id).toBe(true);
    const profile = await db.teacherProfile.findUniqueOrThrow({ where: { userId: teacher.id } });
    expect(profile.timeZone).toBe("Europe/London");
    expect(profile.slug).toMatch(/^user-\d+/);
  });

  it("lets pending teachers prepare a profile, but not students", async () => {
    const pending = await makeUser({ role: "TEACHER", status: "PENDING" });
    expect((await ensureTeacherProfile(pending)).ok).toBe(true);
    expect(await ensureTeacherProfile(await makeStudent())).toMatchObject({ ok: false, code: "FORBIDDEN" });
  });

  it("saves details, topics and languages together", async () => {
    const subject = await makeSubject();
    const [a, b] = await Promise.all([makeTopic(subject.id, "Algebra"), makeTopic(subject.id, "Geometry")]);
    const teacher = await makeTeacher();
    const result = await updateTeacherProfile(teacher, {
      headline: "Maths without the fear",
      about: "I teach algebra and geometry to adults returning to study.",
      timeZone: "Africa/Lagos",
      sessionMinutes: "45",
      acceptingStudents: "on",
      topicIds: [a.id, b.id, a.id],
      languages: ["English", "Igbo"],
    });
    expect(result.ok).toBe(true);
    const profile = await db.teacherProfile.findUniqueOrThrow({ where: { userId: teacher.id }, include: { topics: true, languages: true } });
    expect(profile).toMatchObject({ headline: "Maths without the fear", sessionMinutes: 45, acceptingStudents: true });
    expect(profile.topics).toHaveLength(2);
    expect(profile.languages.map((l) => l.language).sort()).toEqual(["English", "Igbo"]);
  });

  it("rejects topics that don't exist or belong to a closed subject", async () => {
    const closed = await makeSubject({ isActive: false });
    const topic = await makeTopic(closed.id);
    const teacher = await makeTeacher();
    const result = await updateTeacherProfile(teacher, { headline: "", about: "", timeZone: "UTC", sessionMinutes: "60", topicIds: [topic.id] });
    expect(result).toMatchObject({ ok: false, code: "INVALID" });
  });

  it("replaces weekly availability", async () => {
    const teacher = await makeTeacher();
    const windows = JSON.stringify([
      { weekday: 1, startMinute: 540, endMinute: 720 },
      { weekday: 3, startMinute: 1080, endMinute: 1260 },
    ]);
    expect(await setTeacherAvailability(teacher, { windows })).toMatchObject({ ok: true, data: { windows: 2 } });
    expect(await setTeacherAvailability(teacher, { windows: "[]" })).toMatchObject({ ok: true, data: { windows: 0 } });
    expect(await setTeacherAvailability(teacher, { windows: "[{}]" })).toMatchObject({ ok: false, code: "INVALID" });
  });

  it("accepts real images only, and removes them", async () => {
    const teacher = await makeTeacher();
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
    expect((await uploadTeacherPhoto(teacher, png)).ok).toBe(true);
    const profile = await db.teacherProfile.findUniqueOrThrow({ where: { userId: teacher.id }, include: { photo: true } });
    expect(profile.photo?.contentType).toBe("image/png");

    const svg = new TextEncoder().encode("<svg onload='alert(1)'></svg>");
    expect(await uploadTeacherPhoto(teacher, svg)).toMatchObject({ ok: false, code: "INVALID" });
    expect(await uploadTeacherPhoto(teacher, new Uint8Array(2 * 1024 * 1024 + 1))).toMatchObject({ ok: false, code: "INVALID" });
    expect(await uploadTeacherPhoto(teacher, null)).toMatchObject({ ok: false, code: "INVALID" });

    await removeTeacherPhoto(teacher);
    expect(await db.profilePhoto.count()).toBe(0);
  });

  it("lets admins hide a profile, with an audit entry", async () => {
    const [{ profile }, admin] = await Promise.all([listedTeacher(), makeAdmin()]);
    expect((await setProfileHidden(admin, profile.id, true)).ok).toBe(true);
    expect((await db.teacherProfile.findUniqueOrThrow({ where: { id: profile.id } })).isHidden).toBe(true);
    expect(await db.auditLog.count({ where: { action: "profile.hide" } })).toBe(1);
    expect(await setProfileHidden(await makeTeacher(), profile.id, false)).toMatchObject({ ok: false, code: "FORBIDDEN" });
    expect(await setProfileHidden(admin, "missing", false)).toMatchObject({ ok: false, code: "NOT_FOUND" });
  });
});

describe("topics", () => {
  it("adds, renames and removes topics within a subject", async () => {
    const [admin, subject] = await Promise.all([makeAdmin(), makeSubject()]);
    const created = await createTopic(admin, subject.id, { name: "Pharmacology" });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(await createTopic(admin, subject.id, { name: "Pharmacology" })).toMatchObject({ ok: false, code: "CONFLICT" });
    expect((await renameTopic(admin, created.data.id, { name: "Clinical pharmacology" })).ok).toBe(true);
    expect((await db.topic.findUniqueOrThrow({ where: { id: created.data.id } })).slug).toBe("clinical-pharmacology");
    expect((await deleteTopic(admin, created.data.id)).ok).toBe(true);
    expect(await db.topic.count()).toBe(0);
  });

  it("is admin-only and validates names", async () => {
    const [admin, teacher, subject] = await Promise.all([makeAdmin(), makeTeacher(), makeSubject()]);
    expect(await createTopic(teacher, subject.id, { name: "Anything" })).toMatchObject({ ok: false, code: "FORBIDDEN" });
    expect(await createTopic(admin, subject.id, { name: "x" })).toMatchObject({ ok: false, code: "INVALID" });
    expect(await createTopic(admin, "missing", { name: "Real topic" })).toMatchObject({ ok: false, code: "NOT_FOUND" });
    expect(await deleteTopic(admin, "missing")).toMatchObject({ ok: false, code: "NOT_FOUND" });
  });
});

describe("choosing a teacher", () => {
  it("sends a request with a first session, and acceptance confirms it", async () => {
    const { teacher, topic } = await listedTeacher();
    const student = await makeStudent();
    const request = await requestTeacher(student, teacher.id, { goals: GOALS, topicId: topic.id, slotStart: MONDAY_5PM }, NOW);
    expect(request.ok).toBe(true);
    if (!request.ok) return;

    const pending = await db.teacherConnection.findUniqueOrThrow({ where: { id: request.data.connectionId }, include: { sessions: true } });
    expect(pending).toMatchObject({ status: "PENDING", topicId: topic.id });
    expect(pending.sessions[0]).toMatchObject({ status: "REQUESTED" });

    expect(await respondToRequest(teacher, request.data.connectionId, true, {}, NOW)).toMatchObject({ ok: true, data: { status: "ACTIVE" } });
    const session = await db.tutoringSession.findFirstOrThrow({ where: { connectionId: request.data.connectionId } });
    expect(session.status).toBe("CONFIRMED");
    expect(await respondToRequest(teacher, request.data.connectionId, true, {}, NOW)).toMatchObject({ ok: false, code: "CONFLICT" });
  });

  it("declining cancels the requested session and keeps the note", async () => {
    const { teacher } = await listedTeacher();
    const student = await makeStudent();
    const request = await requestTeacher(student, teacher.id, { goals: GOALS, slotStart: MONDAY_5PM }, NOW);
    if (!request.ok) throw new Error(request.message);
    await respondToRequest(teacher, request.data.connectionId, false, { note: "I'm fully booked this term." }, NOW);
    const connection = await db.teacherConnection.findUniqueOrThrow({ where: { id: request.data.connectionId }, include: { sessions: true } });
    expect(connection).toMatchObject({ status: "DECLINED", responseNote: "I'm fully booked this term." });
    expect(connection.sessions[0].status).toBe("CANCELLED");

    // They can ask again later.
    expect((await requestTeacher(student, teacher.id, { goals: GOALS }, NOW)).ok).toBe(true);
  });

  it("refuses unlisted, hidden or full teachers, and duplicate requests", async () => {
    const student = await makeStudent();
    const noProfile = await makeTeacher();
    expect(await requestTeacher(student, noProfile.id, { goals: GOALS }, NOW)).toMatchObject({ ok: false, code: "NOT_FOUND" });

    const hidden = await listedTeacher({ isHidden: true });
    expect(await requestTeacher(student, hidden.teacher.id, { goals: GOALS }, NOW)).toMatchObject({ ok: false, code: "NOT_FOUND" });

    const incomplete = await listedTeacher({ windows: [] });
    expect(await requestTeacher(student, incomplete.teacher.id, { goals: GOALS }, NOW)).toMatchObject({ ok: false, code: "NOT_FOUND" });

    const full = await listedTeacher({ acceptingStudents: false });
    expect(await requestTeacher(student, full.teacher.id, { goals: GOALS }, NOW)).toMatchObject({ ok: false, code: "CONFLICT" });

    const open = await listedTeacher();
    expect((await requestTeacher(student, open.teacher.id, { goals: GOALS }, NOW)).ok).toBe(true);
    expect(await requestTeacher(student, open.teacher.id, { goals: GOALS }, NOW)).toMatchObject({ ok: false, code: "CONFLICT" });
    expect(await requestTeacher(open.teacher, open.teacher.id, { goals: GOALS }, NOW)).toMatchObject({ ok: false, code: "FORBIDDEN" });
  });

  it("validates the slot, the topic and the goals", async () => {
    const { teacher } = await listedTeacher();
    const student = await makeStudent();
    expect(await requestTeacher(student, teacher.id, { goals: GOALS, slotStart: "2026-09-29T17:00:00.000Z" }, NOW)).toMatchObject({
      ok: false,
      code: "CONFLICT",
    });
    expect(await requestTeacher(student, teacher.id, { goals: GOALS, topicId: "someone-elses-topic" }, NOW)).toMatchObject({
      ok: false,
      code: "INVALID",
    });
    expect(await requestTeacher(student, teacher.id, { goals: "hi" }, NOW)).toMatchObject({ ok: false, code: "INVALID" });
  });

  it("stops a slot being requested twice", async () => {
    const { teacher } = await listedTeacher();
    const [first, second] = await Promise.all([makeStudent(), makeStudent()]);
    expect((await requestTeacher(first, teacher.id, { goals: GOALS, slotStart: MONDAY_5PM }, NOW)).ok).toBe(true);
    expect(await requestTeacher(second, teacher.id, { goals: GOALS, slotStart: MONDAY_5PM }, NOW)).toMatchObject({ ok: false, code: "CONFLICT" });
    expect((await requestTeacher(second, teacher.id, { goals: GOALS, slotStart: MONDAY_6PM }, NOW)).ok).toBe(true);
  });

  it("gives a slot to exactly one student when several request it at once", async () => {
    const { teacher } = await listedTeacher();
    const students = await Promise.all(Array.from({ length: 4 }, () => makeStudent()));
    const results = await Promise.all(students.map((student) => requestTeacher(student, teacher.id, { goals: GOALS, slotStart: MONDAY_5PM }, NOW)));
    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect(results.every((result) => result.ok || result.code === "CONFLICT")).toBe(true);
    expect(await db.tutoringSession.count({ where: { teacherId: teacher.id, status: { not: "CANCELLED" } } })).toBe(1);
  });

  it("treats a double-submitted request as one", async () => {
    const { teacher } = await listedTeacher();
    const student = await makeStudent();
    const results = await Promise.all([requestTeacher(student, teacher.id, { goals: GOALS }, NOW), requestTeacher(student, teacher.id, { goals: GOALS }, NOW)]);
    expect(results.every((result) => result.ok)).toBe(true);
    expect(await db.teacherConnection.count({ where: { studentId: student.id } })).toBe(1);
  });

  it("applies a double-submitted acceptance once and keeps the session", async () => {
    const { teacher } = await listedTeacher();
    const student = await makeStudent();
    const request = await requestTeacher(student, teacher.id, { goals: GOALS, slotStart: MONDAY_5PM }, NOW);
    if (!request.ok) throw new Error(request.message);
    const replies = await Promise.all([
      respondToRequest(teacher, request.data.connectionId, true, {}, NOW),
      respondToRequest(teacher, request.data.connectionId, true, {}, NOW),
    ]);
    expect(replies.filter((reply) => reply.ok)).toHaveLength(1);
    expect(replies.find((reply) => !reply.ok)).toMatchObject({ code: "CONFLICT" });
    expect(await db.tutoringSession.findFirstOrThrow({ where: { connectionId: request.data.connectionId } })).toMatchObject({ status: "CONFIRMED" });
  });

  it("caps how many requests a student can have waiting", async () => {
    const student = await makeStudent();
    for (let i = 0; i < MAX_PENDING_REQUESTS; i++) {
      const { teacher } = await listedTeacher();
      expect((await requestTeacher(student, teacher.id, { goals: GOALS }, NOW)).ok).toBe(true);
    }
    const { teacher } = await listedTeacher();
    expect(await requestTeacher(student, teacher.id, { goals: GOALS }, NOW)).toMatchObject({ ok: false, code: "CONFLICT" });
  });

  it("drops a requested time that passed before the teacher accepted", async () => {
    const { teacher } = await listedTeacher();
    const student = await makeStudent();
    const request = await requestTeacher(student, teacher.id, { goals: GOALS, slotStart: MONDAY_5PM }, NOW);
    if (!request.ok) throw new Error(request.message);
    await respondToRequest(teacher, request.data.connectionId, true, {}, new Date("2026-09-29T09:00:00Z"));
    const session = await db.tutoringSession.findFirstOrThrow({ where: { connectionId: request.data.connectionId } });
    expect(session).toMatchObject({ status: "CANCELLED", cancelReason: "The time passed before the request was accepted." });
  });

  it("only lets the right teacher reply", async () => {
    const { teacher } = await listedTeacher();
    const [student, other] = await Promise.all([makeStudent(), makeTeacher()]);
    const request = await requestTeacher(student, teacher.id, { goals: GOALS }, NOW);
    if (!request.ok) throw new Error(request.message);
    expect(await respondToRequest(other, request.data.connectionId, true, {}, NOW)).toMatchObject({ ok: false, code: "NOT_FOUND" });
    expect(await respondToRequest(student, request.data.connectionId, true, {}, NOW)).toMatchObject({ ok: false, code: "FORBIDDEN" });
  });
});

describe("sessions", () => {
  it("books open slots and blocks clashes for teacher and student", async () => {
    const pair = await activePair();
    expect((await bookSession(pair.student, pair.connectionId, { slotStart: MONDAY_5PM, agenda: "Tablet doses" }, NOW)).ok).toBe(true);
    expect(await bookSession(pair.student, pair.connectionId, { slotStart: MONDAY_5PM }, NOW)).toMatchObject({ ok: false, code: "CONFLICT" });
    // 17:30 overlaps the 17:00–18:00 session.
    expect(await bookSession(pair.student, pair.connectionId, { slotStart: "2026-09-28T17:30:00.000Z" }, NOW)).toMatchObject({
      ok: false,
      code: "CONFLICT",
    });
    expect((await bookSession(pair.student, pair.connectionId, { slotStart: MONDAY_6PM }, NOW)).ok).toBe(true);
  });

  it("books a contested slot only once when students race for it", async () => {
    const { teacher } = await listedTeacher();
    const pairs: { student: Awaited<ReturnType<typeof makeStudent>>; connectionId: string }[] = [];
    for (const student of await Promise.all(Array.from({ length: 4 }, () => makeStudent()))) {
      const request = await requestTeacher(student, teacher.id, { goals: GOALS }, NOW);
      if (!request.ok) throw new Error(request.message);
      await respondToRequest(teacher, request.data.connectionId, true, {}, NOW);
      pairs.push({ student, connectionId: request.data.connectionId });
    }
    const results = await Promise.all(pairs.map(({ student, connectionId }) => bookSession(student, connectionId, { slotStart: MONDAY_6PM }, NOW)));
    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect(results.every((result) => result.ok || result.code === "CONFLICT")).toBe(true);
    expect(await db.tutoringSession.count({ where: { teacherId: teacher.id, startsAt: new Date(MONDAY_6PM) } })).toBe(1);
  });

  it("only books for accepted students, and caps upcoming sessions", async () => {
    const { teacher } = await listedTeacher({ windows: [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, startMinute: 480, endMinute: 1200 })) });
    const student = await makeStudent();
    const request = await requestTeacher(student, teacher.id, { goals: GOALS }, NOW);
    if (!request.ok) throw new Error(request.message);
    expect(await bookSession(student, request.data.connectionId, { slotStart: MONDAY_5PM }, NOW)).toMatchObject({ ok: false, code: "CONFLICT" });

    await respondToRequest(teacher, request.data.connectionId, true, {}, NOW);
    for (let i = 0; i < MAX_UPCOMING_SESSIONS; i++) {
      const start = new Date(Date.UTC(2026, 8, 28 + i, 9));
      expect((await bookSession(student, request.data.connectionId, { slotStart: start.toISOString() }, NOW)).ok).toBe(true);
    }
    const extra = new Date(Date.UTC(2026, 8, 28, 12)).toISOString();
    expect(await bookSession(student, request.data.connectionId, { slotStart: extra }, NOW)).toMatchObject({ ok: false, code: "CONFLICT" });
    expect(await bookSession(await makeStudent(), request.data.connectionId, { slotStart: extra }, NOW)).toMatchObject({ ok: false, code: "NOT_FOUND" });
  });

  it("lets either side cancel before the start, with a reason", async () => {
    const pair = await activePair();
    const booked = await bookSession(pair.student, pair.connectionId, { slotStart: MONDAY_5PM }, NOW);
    if (!booked.ok) throw new Error(booked.message);
    expect(await cancelSession(pair.teacher, booked.data.sessionId, { reason: "Unwell" }, new Date("2026-09-28T18:00:00Z"))).toMatchObject({
      ok: false,
      code: "CONFLICT",
    });
    expect((await cancelSession(pair.teacher, booked.data.sessionId, { reason: "Unwell" }, NOW)).ok).toBe(true);
    expect(await db.tutoringSession.findUniqueOrThrow({ where: { id: booked.data.sessionId } })).toMatchObject({
      status: "CANCELLED",
      cancelReason: "Unwell",
      cancelledById: pair.teacher.id,
    });
    expect(await cancelSession(pair.student, booked.data.sessionId, {}, NOW)).toMatchObject({ ok: false, code: "CONFLICT" });
    expect(await cancelSession(await makeStudent(), booked.data.sessionId, {}, NOW)).toMatchObject({ ok: false, code: "NOT_FOUND" });
  });

  it("ending the relationship cancels future sessions", async () => {
    const pair = await activePair();
    await bookSession(pair.student, pair.connectionId, { slotStart: MONDAY_5PM }, NOW);
    expect((await endConnection(pair.student, pair.connectionId, NOW)).ok).toBe(true);
    expect(await db.tutoringSession.count({ where: { status: "CANCELLED" } })).toBe(1);
    expect(await endConnection(pair.teacher, pair.connectionId, NOW)).toMatchObject({ ok: false, code: "CONFLICT" });
    expect(await endConnection(await makeStudent(), pair.connectionId, NOW)).toMatchObject({ ok: false, code: "NOT_FOUND" });
  });
});

describe("messages, reviews and saved teachers", () => {
  it("lets the two people message each other and tracks what's read", async () => {
    const pair = await activePair();
    expect((await sendMessage(pair.student, pair.connectionId, { body: "Hello! Looking forward to Monday." })).ok).toBe(true);
    expect(await sendMessage(pair.student, pair.connectionId, { body: "  " })).toMatchObject({ ok: false, code: "INVALID" });
    expect(await sendMessage(await makeStudent(), pair.connectionId, { body: "Hi" })).toMatchObject({ ok: false, code: "NOT_FOUND" });

    expect(await markThreadRead(pair.teacher, pair.connectionId)).toMatchObject({ ok: true, data: { updated: 1 } });
    expect(await markThreadRead(pair.student, pair.connectionId)).toMatchObject({ ok: true, data: { updated: 0 } });

    await endConnection(pair.teacher, pair.connectionId, NOW);
    expect(await sendMessage(pair.student, pair.connectionId, { body: "Are you there?" })).toMatchObject({ ok: false, code: "CONFLICT" });
  });

  it("allows a review only after a session, one per teacher, editable", async () => {
    const pair = await activePair();
    const review = { rating: "5", body: "Explains dosage maths so it finally makes sense." };
    expect(await saveReview(pair.student, pair.teacher.id, review, NOW)).toMatchObject({ ok: false, code: "CONFLICT" });

    await bookSession(pair.student, pair.connectionId, { slotStart: MONDAY_5PM }, NOW);
    const afterSession = new Date("2026-09-28T19:00:00Z");
    expect((await saveReview(pair.student, pair.teacher.id, review, afterSession)).ok).toBe(true);
    expect((await saveReview(pair.student, pair.teacher.id, { ...review, rating: "4" }, afterSession)).ok).toBe(true);
    const saved = await db.teacherReview.findFirstOrThrow({ where: { teacherId: pair.teacher.id } });
    expect(saved.rating).toBe(4);
    expect(await db.teacherReview.count()).toBe(1);

    const admin = await makeAdmin();
    expect((await setReviewHidden(admin, saved.id, true)).ok).toBe(true);
    expect((await db.teacherReview.findUniqueOrThrow({ where: { id: saved.id } })).isHidden).toBe(true);
    expect(await setReviewHidden(pair.teacher, saved.id, false)).toMatchObject({ ok: false, code: "FORBIDDEN" });
    expect(await saveReview(pair.teacher, pair.teacher.id, review, afterSession)).toMatchObject({ ok: false, code: "FORBIDDEN" });
  });

  it("saves and unsaves teachers", async () => {
    const { teacher } = await listedTeacher();
    const student = await makeStudent();
    expect(await toggleSavedTeacher(student, teacher.id)).toMatchObject({ ok: true, data: { saved: true } });
    expect(await toggleSavedTeacher(student, teacher.id)).toMatchObject({ ok: true, data: { saved: false } });
    expect(await toggleSavedTeacher(student, "missing")).toMatchObject({ ok: false, code: "NOT_FOUND" });
    expect(await toggleSavedTeacher(teacher, teacher.id)).toMatchObject({ ok: false, code: "FORBIDDEN" });
  });
});

describe("time zones on accounts", () => {
  it("captures the browser zone once and lets people change it", async () => {
    const student = await makeStudent();
    await captureTimeZone(student.id, "Africa/Lagos");
    await captureTimeZone(student.id, "Asia/Tokyo");
    await captureTimeZone(student.id, "Not/AZone");
    expect((await db.user.findUniqueOrThrow({ where: { id: student.id } })).timeZone).toBe("Africa/Lagos");

    expect((await setTimeZone(student, { timeZone: "Europe/London" })).ok).toBe(true);
    expect(await setTimeZone(student, { timeZone: "Nowhere" })).toMatchObject({ ok: false, code: "INVALID" });
    expect((await db.user.findUniqueOrThrow({ where: { id: student.id } })).timeZone).toBe("Europe/London");
  });
});
