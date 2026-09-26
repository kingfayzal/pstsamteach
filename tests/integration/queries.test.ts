import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { getProfile } from "@/server/queries/account";
import {
  getAdminOverview,
  getCourseForReview,
  getReviewCount,
  getReviewQueue,
  getUserDetail,
  listAllCourses,
  listAudit,
  listPlatformAnnouncements,
  listSubjectsWithCounts,
  listUsers,
} from "@/server/queries/admin";
import { getPublicCourse, isEnrolled, listActiveSubjects, listCatalog, listFeaturedCourses } from "@/server/queries/catalog";
import {
  getRecentResults,
  getStudentAnnouncements,
  getStudentAssessment,
  getStudentCourse,
  getStudentCourses,
  getStudentGrades,
  getStudentLesson,
} from "@/server/queries/student";
import {
  getAssessmentForEditor,
  getCourseAnnouncements,
  getCourseForEditor,
  getCourseRoster,
  getLessonForEditor,
  getMarkingQueue,
  getOwnApplication,
  getRecentlyMarked,
  getSubmissionForMarking,
  getTeacherAnnouncements,
  getTeacherCourses,
  getTeacherStats,
} from "@/server/queries/teacher";
import { enroll, makeAdmin, makeAssessment, makeCourse, makeStudent, makeSubject, makeTeacher, makeUser, resetDb } from "./factories";

beforeEach(resetDb);

/** One published course with a quiz and an assignment, a draft, and a student part-way through. */
async function scenario() {
  const [maths, closed] = await Promise.all([makeSubject({ name: "Maths" }), makeSubject({ name: "Closed", isActive: false })]);
  const [teacher, otherTeacher, admin, student, outsider] = await Promise.all([makeTeacher(), makeTeacher(), makeAdmin(), makeStudent(), makeStudent()]);
  const course = await makeCourse(teacher.id, maths.id, { status: "PUBLISHED", title: "Algebra basics", lessons: 3 });
  const draft = await makeCourse(teacher.id, maths.id, { status: "DRAFT", title: "Draft geometry" });
  const hidden = await makeCourse(otherTeacher.id, closed.id, { status: "PUBLISHED", title: "Hidden subject course" });
  const quiz = await makeAssessment(course.id, { passPercent: 50 });
  const assignment = await makeAssessment(course.id, { kind: "ASSIGNMENT", maxPoints: 10, dueAt: new Date(Date.now() + 86_400_000) });

  await enroll(student.id, course.id);
  await db.lessonProgress.create({ data: { userId: student.id, lessonId: course.lessons[0].id } });
  await db.submission.create({
    data: { assessmentId: quiz.id, studentId: student.id, answers: "{}", score: 2, maxScore: 2, status: "GRADED", gradedAt: new Date() },
  });
  const submitted = await db.submission.create({
    data: { assessmentId: assignment.id, studentId: student.id, response: "My working and my answer.", maxScore: 10 },
  });
  await db.announcement.create({ data: { title: "Course note", body: "Quiz is open.", courseId: course.id, authorId: teacher.id } });
  await db.announcement.create({ data: { title: "Hidden note", body: "Other course.", courseId: hidden.id, authorId: otherTeacher.id } });
  await db.announcement.create({ data: { title: "Welcome", body: "Hello all.", audience: "EVERYONE", authorId: admin.id } });
  await db.announcement.create({ data: { title: "Teachers only", body: "Staff note.", audience: "TEACHERS", authorId: admin.id } });
  await db.auditLog.create({ data: { actorId: admin.id, action: "course.approve", entity: "course", entityId: course.id, summary: "Approved" } });

  return { maths, teacher, otherTeacher, admin, student, outsider, course, draft, hidden, quiz, assignment, submitted };
}

describe("catalog queries", () => {
  it("lists only published courses in open subjects", async () => {
    const s = await scenario();
    const subjects = await listActiveSubjects();
    expect(subjects.map((x) => x.name)).toEqual(["Maths"]);
    expect(subjects[0]._count.courses).toBe(1);

    expect((await listCatalog({})).map((c) => c.title)).toEqual(["Algebra basics"]);
    expect(await listCatalog({ subject: s.maths.slug, q: "algebra" })).toHaveLength(1);
    expect(await listCatalog({ q: "geometry" })).toHaveLength(0);
    expect(await listFeaturedCourses()).toHaveLength(1);
  });

  it("shows public course pages for published courses only", async () => {
    const s = await scenario();
    const page = await getPublicCourse(s.course.slug);
    expect(page?.lessons).toHaveLength(3);
    expect(page?.assessments).toHaveLength(2);
    expect(await getPublicCourse(s.draft.slug)).toBeNull();
    expect(await isEnrolled(s.student.id, s.course.id)).toBe(true);
    expect(await isEnrolled(s.outsider.id, s.course.id)).toBe(false);
  });
});

describe("student queries", () => {
  it("summarises progress across enrolled courses", async () => {
    const s = await scenario();
    const [entry] = await getStudentCourses(s.student.id);
    // 1 of 3 lessons + 1 of 2 assessments passed = 2 of 5.
    expect(entry.summary.progress.percent).toBe(40);
    expect(entry.summary.nextLessonId).toBe(s.course.lessons[1].id);
    expect(entry.summary.assessments.map((a) => a.state)).toEqual(["passed", "awaiting"]);
  });

  it("only opens courses, lessons and assessments the student is enrolled in", async () => {
    const s = await scenario();
    expect(await getStudentCourse(s.outsider.id, s.course.slug)).toBeNull();
    const home = await getStudentCourse(s.student.id, s.course.slug);
    expect(home?.course.announcements.map((a) => a.title)).toEqual(["Course note"]);

    const lesson = await getStudentLesson(s.student.id, s.course.slug, s.course.lessons[1].id);
    expect(lesson?.previous?.id).toBe(s.course.lessons[0].id);
    expect(lesson?.next?.id).toBe(s.course.lessons[2].id);
    expect(lesson?.isComplete).toBe(false);
    expect(await getStudentLesson(s.outsider.id, s.course.slug, s.course.lessons[0].id)).toBeNull();

    const assessment = await getStudentAssessment(s.student.id, s.course.slug, s.quiz.id);
    expect(assessment?.submissions).toHaveLength(1);
    expect(await getStudentAssessment(s.outsider.id, s.course.slug, s.quiz.id)).toBeNull();
  });

  it("lists grades, recent results and relevant announcements", async () => {
    const s = await scenario();
    expect(await getStudentGrades(s.student.id)).toHaveLength(2);
    expect((await getRecentResults(s.student.id)).map((r) => r.assessment.id)).toEqual([s.quiz.id]);
    const titles = (await getStudentAnnouncements(s.student.id)).map((a) => a.title).sort();
    expect(titles).toEqual(["Course note", "Welcome"]);
  });
});

describe("teacher queries", () => {
  it("scopes courses to their teacher, and shows admins everything", async () => {
    const s = await scenario();
    expect((await getTeacherCourses(s.teacher)).map((c) => c.title).sort()).toEqual(["Algebra basics", "Draft geometry"]);
    expect(await getTeacherCourses(s.admin)).toHaveLength(3);
    expect(await getTeacherStats(s.teacher)).toEqual({ students: 1, published: 1, awaiting: 1 });
  });

  it("builds the marking queue and marked list", async () => {
    const s = await scenario();
    const queue = await getMarkingQueue(s.teacher);
    expect(queue.map((q) => q.id)).toEqual([s.submitted.id]);
    expect(await getMarkingQueue(s.otherTeacher)).toHaveLength(0);

    await db.submission.update({ where: { id: s.submitted.id }, data: { status: "GRADED", score: 7, gradedById: s.teacher.id, gradedAt: new Date() } });
    expect((await getRecentlyMarked(s.teacher)).map((m) => m.id)).toEqual([s.submitted.id]);
  });

  it("hides editor data from other teachers", async () => {
    const s = await scenario();
    const editor = await getCourseForEditor(s.teacher, s.draft.id);
    expect(editor?.actions).toEqual(["submit"]);
    expect(editor?.blockers).toEqual([]);
    expect(await getCourseForEditor(s.otherTeacher, s.draft.id)).toBeNull();

    expect((await getLessonForEditor(s.teacher, s.course.id, s.course.lessons[0].id))?.title).toBe("Lesson 1");
    expect(await getLessonForEditor(s.otherTeacher, s.course.id, s.course.lessons[0].id)).toBeNull();
    expect((await getAssessmentForEditor(s.teacher, s.course.id, s.quiz.id))?.questions).toHaveLength(2);
    expect(await getAssessmentForEditor(s.otherTeacher, s.course.id, s.quiz.id)).toBeNull();
    expect((await getSubmissionForMarking(s.teacher, s.submitted.id))?.student.name).toBe(s.student.name);
    expect(await getSubmissionForMarking(s.otherTeacher, s.submitted.id)).toBeNull();
  });

  it("reports the roster with progress and activity", async () => {
    const s = await scenario();
    const roster = await getCourseRoster(s.teacher, s.course.id);
    expect(roster?.course.lessonCount).toBe(3);
    expect(roster?.rows[0]).toMatchObject({ student: { id: s.student.id }, completedAt: null });
    expect(roster?.rows[0].summary.progress.percent).toBe(40);
    expect(roster?.rows[0].lastActive).toBeInstanceOf(Date);
    expect(await getCourseRoster(s.otherTeacher, s.course.id)).toBeNull();

    expect((await getCourseAnnouncements(s.teacher, s.course.id))?.announcements).toHaveLength(1);
    expect(await getCourseAnnouncements(s.otherTeacher, s.course.id)).toBeNull();
    expect((await getTeacherAnnouncements()).map((a) => a.title).sort()).toEqual(["Teachers only", "Welcome"]);
  });

  it("shows a pending teacher their own application", async () => {
    const subject = await makeSubject({ name: "Nursing" });
    const applicant = await makeUser({ role: "TEACHER", status: "PENDING" });
    await db.user.update({ where: { id: applicant.id }, data: { applicationNote: "Ward educator.", applicationSubjectId: subject.id } });
    expect(await getOwnApplication(applicant.id)).toMatchObject({ applicationNote: "Ward educator.", applicationSubject: { name: "Nursing" } });
  });
});

describe("admin queries", () => {
  it("summarises the platform", async () => {
    const s = await scenario();
    await makeUser({ role: "TEACHER", status: "PENDING" });
    await db.course.update({ where: { id: s.draft.id }, data: { status: "IN_REVIEW", submittedAt: new Date() } });

    const overview = await getAdminOverview();
    expect(overview.counts).toMatchObject({ students: 2, teachers: 2, pendingTeachers: 1, enrollments: 1, awaitingMarking: 1 });
    expect(overview.counts.courses).toMatchObject({ PUBLISHED: 2, IN_REVIEW: 1 });
    expect(overview.signups).toHaveLength(14);
    expect(overview.reviewQueue.map((c) => c.id)).toEqual([s.draft.id]);
    expect(overview.pending).toHaveLength(1);
    expect(overview.audit).toHaveLength(1);

    const queue = await getReviewQueue();
    expect(queue.courses).toHaveLength(1);
    expect(queue.applicants).toHaveLength(1);
    expect(await getReviewCount()).toBe(2);
  });

  it("filters people and courses", async () => {
    const s = await scenario();
    expect((await listUsers({ role: "STUDENT" })).total).toBe(2);
    expect((await listUsers({ q: s.student.email.toUpperCase() })).users.map((u) => u.id)).toEqual([s.student.id]);
    expect((await listUsers({ status: "SUSPENDED" })).total).toBe(0);
    expect((await listUsers({ role: "NOT_A_ROLE" })).total).toBe(5);

    expect(await listAllCourses({ status: "DRAFT" })).toHaveLength(1);
    expect(await listAllCourses({ q: "algebra", subject: s.maths.slug })).toHaveLength(1);
    expect(await listAllCourses({})).toHaveLength(3);
  });

  it("loads details for review", async () => {
    const s = await scenario();
    const detail = await getUserDetail(s.teacher.id);
    expect(detail?.courses).toHaveLength(2);
    expect(await getUserDetail("missing")).toBeNull();

    const review = await getCourseForReview(s.course.id);
    expect(review?.assessments[0].questions[0].options.some((o) => o.isCorrect)).toBe(true);

    const subjects = await listSubjectsWithCounts();
    // Same position, so alphabetical.
    expect(subjects.map((x) => x.name)).toEqual(["Closed", "Maths"]);
    expect((await listPlatformAnnouncements()).map((a) => a.title).sort()).toEqual(["Teachers only", "Welcome"]);
  });

  it("pages the activity log", async () => {
    const admin = await makeAdmin();
    await db.auditLog.createMany({
      data: Array.from({ length: 55 }, (_, i) => ({ actorId: admin.id, action: "test", entity: "user", summary: `Entry ${i}` })),
    });
    const first = await listAudit(1);
    expect(first).toMatchObject({ total: 55, page: 1, pages: 2 });
    expect(first.entries).toHaveLength(50);
    expect((await listAudit(2)).entries).toHaveLength(5);
    expect((await listAudit(-3)).page).toBe(1);
  });

  it("reads a profile", async () => {
    const student = await makeStudent();
    expect(await getProfile(student.id)).toEqual({ name: student.name, bio: null, timeZone: null });
  });
});
