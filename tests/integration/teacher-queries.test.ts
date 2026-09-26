import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { getTeacherModeration, getTutoringOverview, listTeacherProfilesForAdmin } from "@/server/queries/admin";
import {
  countPendingRequests,
  countUnreadMessages,
  getStudentConnection,
  getTeacherConnection,
  listStudentConnections,
  listTeacherConnections,
  listUpcomingSessions,
} from "@/server/queries/connections";
import { labelSlotGroups } from "@/server/queries/slot-labels";
import {
  getBookingSlots,
  getProfileEditor,
  getTeacherPhoto,
  getTeacherProfilePage,
  listDirectory,
  listSubjectsWithTopics,
} from "@/server/queries/teachers";
import { requestTeacher, respondToRequest } from "@/server/services/connections";
import { sendMessage } from "@/server/services/teacher-social";
import { bookSession } from "@/server/services/tutoring";
import { shortName } from "@/lib/format";
import { parseDirectoryFilters } from "@/lib/teacher-directory";
import { enroll, makeAdmin, makeCourse, makeStudent, makeSubject, makeTeacher, makeTeacherProfile, makeTopic, resetDb } from "./factories";

beforeEach(resetDb);

// Sunday 27 Sept 2026, midday UTC. Profiles default to Monday 18:00–20:00 Lagos (17:00–19:00 UTC).
const NOW = new Date("2026-09-27T12:00:00Z");
const LAGOS = { timeZone: "Africa/Lagos" };
const GOALS = "I want to understand dosage calculations properly before my exam.";
const filters = (params: Record<string, string> = {}) => parseDirectoryFilters(params);

async function directoryScenario() {
  const [nursing, maths] = await Promise.all([makeSubject({ name: "Nursing" }), makeSubject({ name: "Maths" })]);
  const [dosage, algebra] = await Promise.all([makeTopic(nursing.id, "Dosage calculations"), makeTopic(maths.id, "Algebra")]);
  const [ruth, daniel, hidden, incomplete, full] = await Promise.all([makeTeacher(), makeTeacher(), makeTeacher(), makeTeacher(), makeTeacher()]);
  const ruthProfile = await makeTeacherProfile(ruth.id, { topicIds: [dosage.id], languages: ["English", "Twi"], headline: "Dosage calculations made simple" });
  await makeTeacherProfile(daniel.id, {
    topicIds: [algebra.id],
    languages: ["English"],
    windows: [{ weekday: 6, startMinute: 9 * 60, endMinute: 12 * 60 }],
    headline: "Algebra without fear",
  });
  await makeTeacherProfile(hidden.id, { topicIds: [dosage.id], isHidden: true });
  await makeTeacherProfile(incomplete.id, { topicIds: [], headline: "Nearly ready" });
  await makeTeacherProfile(full.id, { topicIds: [algebra.id], acceptingStudents: false, headline: "Fully booked maths" });
  return { nursing, maths, dosage, algebra, ruth, daniel, hidden, incomplete, full, ruthProfile };
}

async function pair() {
  const s = await directoryScenario();
  const student = await makeStudent();
  const request = await requestTeacher(student, s.ruth.id, { goals: GOALS, topicId: s.dosage.id, slotStart: "2026-09-28T17:00:00.000Z" }, NOW);
  if (!request.ok) throw new Error(request.message);
  return { ...s, student, connectionId: request.data.connectionId };
}

describe("listDirectory", () => {
  it("lists complete, visible teachers only", async () => {
    await directoryScenario();
    const names = (await listDirectory(filters(), LAGOS, NOW)).map((r) => r.headline).sort();
    expect(names).toEqual(["Algebra without fear", "Dosage calculations made simple", "Fully booked maths"]);
  });

  it("filters by subject, topic, language, search and taking students", async () => {
    const scenario = await directoryScenario();
    expect((await listDirectory(filters({ subject: scenario.nursing.slug }), LAGOS, NOW)).map((r) => r.headline)).toEqual(["Dosage calculations made simple"]);
    expect((await listDirectory(filters({ topic: "dosage-calculations" }), LAGOS, NOW)).map((r) => r.headline)).toEqual(["Dosage calculations made simple"]);
    expect((await listDirectory(filters({ language: "Twi" }), LAGOS, NOW)).map((r) => r.headline)).toEqual(["Dosage calculations made simple"]);
    expect((await listDirectory(filters({ q: "fear" }), LAGOS, NOW)).map((r) => r.headline)).toEqual(["Algebra without fear"]);
    expect((await listDirectory(filters({ accepting: "1" }), LAGOS, NOW)).map((r) => r.headline)).not.toContain("Fully booked maths");
  });

  it("filters by day and time of day in the viewer's zone", async () => {
    await directoryScenario();
    expect((await listDirectory(filters({ day: "6", time: "morning" }), LAGOS, NOW)).map((r) => r.headline)).toEqual(["Algebra without fear"]);
    expect((await listDirectory(filters({ day: "1", time: "evening" }), LAGOS, NOW)).map((r) => r.headline).sort()).toEqual([
      "Dosage calculations made simple",
      "Fully booked maths",
    ]);
  });

  it("works out stats, the next free slot and the viewer's shortlist", async () => {
    const s = await pair();
    await respondToRequest(s.ruth, s.connectionId, true, {}, NOW);
    await db.teacherReview.create({ data: { teacherId: s.ruth.id, studentId: s.student.id, rating: 5, body: "Brilliant teacher, very patient." } });
    await db.savedTeacher.create({ data: { studentId: s.student.id, teacherId: s.ruth.id } });

    const rows = await listDirectory(filters({ topic: "dosage-calculations" }), { id: s.student.id, role: "STUDENT", timeZone: "Africa/Lagos" }, NOW);
    expect(rows[0]).toMatchObject({ average: 5, reviewCount: 1, students: 1, saved: true });
    // The 17:00 slot is taken by the confirmed first session, so the next free start is 18:00 UTC.
    expect(rows[0].nextSlot?.toISOString()).toBe("2026-09-28T18:00:00.000Z");

    const shortlist = await listDirectory(filters({ saved: "1" }), { id: s.student.id, role: "STUDENT", timeZone: "Africa/Lagos" }, NOW);
    expect(shortlist.map((r) => r.teacherId)).toEqual([s.ruth.id]);
  });

  it("offers open subjects with their topics for the filters", async () => {
    await directoryScenario();
    const subjects = await listSubjectsWithTopics();
    expect(subjects.map((s) => [s.name, s.topics.length])).toEqual(expect.arrayContaining([["Nursing", 1], ["Maths", 1]]));
  });
});

describe("getTeacherProfilePage", () => {
  it("shows listed profiles to everyone, with a timetable in the viewer's zone", async () => {
    const s = await directoryScenario();
    const page = await getTeacherProfilePage(s.ruthProfile.slug, LAGOS, NOW);
    expect(page?.profile.headline).toBe("Dosage calculations made simple");
    expect(page?.timetable[1].evening).toBe(true);
    expect(page?.nextSlot?.toISOString()).toBe("2026-09-28T17:00:00.000Z");
    expect(page?.viewerRelation).toEqual({ connection: null, saved: false, canReview: false, ownReview: null });
  });

  it("hides unlisted profiles except from their owner and admins", async () => {
    const s = await directoryScenario();
    const hiddenSlug = (await db.teacherProfile.findUniqueOrThrow({ where: { userId: s.hidden.id } })).slug;
    expect(await getTeacherProfilePage(hiddenSlug, LAGOS, NOW)).toBeNull();
    expect(await getTeacherProfilePage(hiddenSlug, { id: s.hidden.id, role: "TEACHER", timeZone: "UTC" }, NOW)).not.toBeNull();
    const admin = await makeAdmin();
    const asAdmin = await getTeacherProfilePage(hiddenSlug, { id: admin.id, role: "ADMIN", timeZone: "UTC" }, NOW);
    expect(asAdmin?.isHidden).toBe(true);
    expect(await getTeacherProfilePage("no-such-teacher", LAGOS, NOW)).toBeNull();
  });

  it("tells a student about their relationship with the teacher", async () => {
    const s = await pair();
    await respondToRequest(s.ruth, s.connectionId, true, {}, NOW);
    const later = new Date("2026-09-29T12:00:00Z");
    await db.teacherReview.create({ data: { teacherId: s.ruth.id, studentId: s.student.id, rating: 4, body: "Clear explanations every time." } });
    const course = await makeCourse(s.ruth.id, s.nursing.id, { status: "PUBLISHED" });
    const page = await getTeacherProfilePage(s.ruthProfile.slug, { id: s.student.id, role: "STUDENT", timeZone: "Africa/Lagos" }, later);
    expect(page?.viewerRelation.connection?.status).toBe("ACTIVE");
    expect(page?.viewerRelation.canReview).toBe(true);
    expect(page?.viewerRelation.ownReview).toMatchObject({ rating: 4 });
    expect(page?.courses.map((c) => c.id)).toEqual([course.id]);
    expect(page?.reviews[0].author).toBe(shortName(s.student.name));
  });
});

describe("booking and editor queries", () => {
  it("groups open slots by the student's day and skips busy times", async () => {
    const s = await pair();
    const days = await getBookingSlots(s.ruth.id, s.student.id, "Africa/Lagos", NOW);
    // 17:00 is held by the pending request, so 17:00 and 17:30 are gone.
    expect(days[0].slots.map((slot) => slot.start.toISOString())).toEqual(["2026-09-28T18:00:00.000Z"]);
    expect(await getBookingSlots("missing", s.student.id, "UTC", NOW)).toEqual([]);

    const labelled = labelSlotGroups(days, "Africa/Lagos");
    expect(labelled[0]).toMatchObject({ key: "2026-09-28", label: "Mon 28 Sept", slots: [{ label: "19:00", value: "2026-09-28T18:00:00.000Z" }] });
  });

  it("reports what a teacher's profile still needs", async () => {
    const s = await directoryScenario();
    const editor = await getProfileEditor(s.incomplete.id);
    expect(editor?.isListed).toBe(false);
    expect(editor?.gaps).toContain("Choose at least one topic you teach.");
    expect((await getProfileEditor(s.ruth.id))?.isListed).toBe(true);
    expect(await getProfileEditor("missing")).toBeNull();
  });

  it("loads a photo with its visibility", async () => {
    const s = await directoryScenario();
    await db.profilePhoto.create({ data: { profileId: s.ruthProfile.id, data: new Uint8Array([1, 2, 3]), contentType: "image/png" } });
    const photo = await getTeacherPhoto(s.ruthProfile.id);
    expect(photo).toMatchObject({ contentType: "image/png", profile: { isHidden: false, userId: s.ruth.id } });
    expect(await getTeacherPhoto("missing")).toBeNull();
  });
});

describe("relationship queries", () => {
  it("lists a student's teachers with unread counts and the next session", async () => {
    const s = await pair();
    await respondToRequest(s.ruth, s.connectionId, true, {}, NOW);
    await sendMessage(s.ruth, s.connectionId, { body: "Welcome aboard!" });
    const [row] = await listStudentConnections(s.student.id, NOW);
    expect(row).toMatchObject({ status: "ACTIVE", unread: 1, topic: { name: "Dosage calculations" } });
    expect(row.nextSession?.startsAt.toISOString()).toBe("2026-09-28T17:00:00.000Z");
    expect(await countUnreadMessages(s.student.id)).toBe(1);
    expect(await countUnreadMessages(s.ruth.id)).toBe(0);

    const detail = await getStudentConnection(s.student.id, s.connectionId);
    expect(detail?.messages).toHaveLength(1);
    expect(detail?.teacher.teacherProfile?.meetingUrl).toBe("https://meet.example.com/room");
    expect(await getStudentConnection((await makeStudent()).id, s.connectionId)).toBeNull();
  });

  it("groups a teacher's requests, students and past students", async () => {
    const s = await pair();
    expect(await countPendingRequests(s.ruth.id)).toBe(1);
    let groups = await listTeacherConnections(s.ruth.id, NOW);
    expect([groups.pending.length, groups.active.length, groups.past.length]).toEqual([1, 0, 0]);

    await respondToRequest(s.ruth, s.connectionId, true, {}, NOW);
    groups = await listTeacherConnections(s.ruth.id, NOW);
    expect([groups.pending.length, groups.active.length]).toEqual([0, 1]);
    expect(await countPendingRequests(s.ruth.id)).toBe(0);
  });

  it("shows the teacher the student's progress in their own courses", async () => {
    const s = await pair();
    const course = await makeCourse(s.ruth.id, s.nursing.id, { status: "PUBLISHED", lessons: 2 });
    await enroll(s.student.id, course.id);
    await db.lessonProgress.create({ data: { userId: s.student.id, lessonId: course.lessons[0].id } });
    const data = await getTeacherConnection(s.ruth.id, s.connectionId);
    expect(data?.courses[0]).toMatchObject({ id: course.id });
    expect(data?.courses[0].summary.progress.percent).toBe(50);
    expect(await getTeacherConnection(s.daniel.id, s.connectionId)).toBeNull();
  });

  it("lists upcoming sessions for both sides, with links only once confirmed", async () => {
    const s = await pair();
    let [pending] = await listUpcomingSessions(s.student.id, "STUDENT", NOW);
    expect(pending).toMatchObject({ status: "REQUESTED", meetingUrl: null, otherName: s.ruth.name });

    await respondToRequest(s.ruth, s.connectionId, true, {}, NOW);
    await bookSession(s.student, s.connectionId, { slotStart: "2026-09-28T18:00:00.000Z" }, NOW);
    const forStudent = await listUpcomingSessions(s.student.id, "STUDENT", NOW);
    expect(forStudent.map((x) => x.startsAt.toISOString())).toEqual(["2026-09-28T17:00:00.000Z", "2026-09-28T18:00:00.000Z"]);
    expect(forStudent[0].meetingUrl).toBe("https://meet.example.com/room");
    [pending] = await listUpcomingSessions(s.ruth.id, "TEACHER", NOW);
    expect(pending.otherName).toBe(s.student.name);
  });
});

describe("admin directory queries", () => {
  it("summarises profiles, moderation and tutoring numbers", async () => {
    const s = await pair();
    const profiles = await listTeacherProfilesForAdmin();
    const ruth = profiles.find((p) => p.user.id === s.ruth.id);
    expect(ruth).toMatchObject({ listed: true, pendingRequests: 1, activeStudents: 0 });
    expect(profiles.find((p) => p.user.id === s.incomplete.id)?.listed).toBe(false);

    await db.teacherReview.create({ data: { teacherId: s.ruth.id, studentId: s.student.id, rating: 5, body: "Great", isHidden: true } });
    const moderation = await getTeacherModeration(s.ruth.id);
    expect(moderation?.reviews).toHaveLength(1);
    expect(await getTeacherModeration((await makeStudent()).id)).toBeNull();

    await respondToRequest(s.ruth, s.connectionId, true, {}, NOW);
    expect(await getTutoringOverview(NOW)).toEqual({ activePairs: 1, pendingRequests: 0, sessionsThisWeek: 1 });
  });
});
