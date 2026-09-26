import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { enrollInCourse, setLessonComplete } from "@/server/services/enrollment";
import { gradeSubmission, submitAssignment, submitQuiz } from "@/server/services/submissions";
import { enroll, makeAssessment, makeCourse, makeStudent, makeSubject, makeTeacher, resetDb } from "./factories";

beforeEach(resetDb);

async function publishedCourse(lessons = 2) {
  const [teacher, subject] = await Promise.all([makeTeacher(), makeSubject()]);
  const course = await makeCourse(teacher.id, subject.id, { status: "PUBLISHED", lessons });
  return { teacher, course };
}

describe("enrollInCourse", () => {
  it("enrols a student once, even if asked twice", async () => {
    const { course } = await publishedCourse();
    const student = await makeStudent();
    expect(await enrollInCourse(student, course.id)).toMatchObject({ ok: true, data: { slug: course.slug } });
    expect((await enrollInCourse(student, course.id)).ok).toBe(true);
    expect(await db.enrollment.count({ where: { userId: student.id } })).toBe(1);
  });

  it("refuses drafts and non-students", async () => {
    const [teacher, subject, student] = await Promise.all([makeTeacher(), makeSubject(), makeStudent()]);
    const draft = await makeCourse(teacher.id, subject.id);
    expect(await enrollInCourse(student, draft.id)).toMatchObject({ ok: false, code: "NOT_FOUND" });
    expect(await enrollInCourse(teacher, draft.id)).toMatchObject({ ok: false, code: "FORBIDDEN" });
  });
});

describe("setLessonComplete", () => {
  it("marks progress and completes the course when everything is done", async () => {
    const { course } = await publishedCourse(2);
    const student = await makeStudent();
    await enroll(student.id, course.id);

    expect(await setLessonComplete(student, course.lessons[0].id, true)).toMatchObject({ ok: true, data: { courseCompleted: false } });
    expect(await setLessonComplete(student, course.lessons[1].id, true)).toMatchObject({ ok: true, data: { courseCompleted: true } });
    const done = await db.enrollment.findFirstOrThrow({ where: { userId: student.id } });
    expect(done.completedAt).not.toBeNull();

    await setLessonComplete(student, course.lessons[1].id, false);
    const undone = await db.enrollment.findFirstOrThrow({ where: { userId: student.id } });
    expect(undone.completedAt).toBeNull();
  });

  it("requires an enrolment", async () => {
    const { course } = await publishedCourse();
    const student = await makeStudent();
    expect(await setLessonComplete(student, course.lessons[0].id, true)).toMatchObject({ ok: false, code: "FORBIDDEN" });
    expect(await setLessonComplete(student, "missing", true)).toMatchObject({ ok: false, code: "NOT_FOUND" });
  });
});

describe("submitQuiz", () => {
  it("auto-marks and stores the attempt", async () => {
    const { course } = await publishedCourse(0);
    const quiz = await makeAssessment(course.id);
    const student = await makeStudent();
    await enroll(student.id, course.id);
    const [q1, q2] = quiz.questions;
    const right = (q: typeof q1) => q.options.find((o) => o.isCorrect)!.id;
    const wrong = (q: typeof q1) => q.options.find((o) => !o.isCorrect)!.id;

    const result = await submitQuiz(student, quiz.id, { [q1.id]: right(q1), [q2.id]: wrong(q2) });
    expect(result).toMatchObject({ ok: true, data: { grade: { score: 1, maxScore: 2, percent: 50 } } });
    const enrollment = await db.enrollment.findFirstOrThrow({ where: { userId: student.id } });
    expect(enrollment.completedAt).toBeNull(); // 50% is below the 60% pass mark

    await submitQuiz(student, quiz.id, { [q1.id]: right(q1), [q2.id]: right(q2) });
    const completed = await db.enrollment.findFirstOrThrow({ where: { userId: student.id } });
    expect(completed.completedAt).not.toBeNull();
    expect(await db.submission.count({ where: { studentId: student.id } })).toBe(2);
  });

  it("insists every question is answered", async () => {
    const { course } = await publishedCourse(0);
    const quiz = await makeAssessment(course.id);
    const student = await makeStudent();
    await enroll(student.id, course.id);
    const result = await submitQuiz(student, quiz.id, { [quiz.questions[0].id]: quiz.questions[0].options[0].id });
    expect(result).toMatchObject({ ok: false, code: "INVALID" });
  });

  it("hides unpublished quizzes and rejects junk answers", async () => {
    const { course } = await publishedCourse(0);
    const hidden = await makeAssessment(course.id, { isPublished: false });
    const open = await makeAssessment(course.id);
    const student = await makeStudent();
    await enroll(student.id, course.id);
    expect(await submitQuiz(student, hidden.id, {})).toMatchObject({ ok: false, code: "NOT_FOUND" });
    expect(await submitQuiz(student, open.id, "not-an-object")).toMatchObject({ ok: false, code: "INVALID" });
  });
});

describe("assignments and marking", () => {
  it("lets a student submit and revise until the teacher marks it", async () => {
    const { teacher, course } = await publishedCourse(0);
    const assignment = await makeAssessment(course.id, { kind: "ASSIGNMENT", maxPoints: 20, passPercent: 50 });
    const student = await makeStudent();
    await enroll(student.id, course.id);

    const essay = "My care plan prioritises airway, then breathing, then circulation.";
    const first = await submitAssignment(student, assignment.id, { response: essay });
    const revised = await submitAssignment(student, assignment.id, { response: `${essay} Revised.` });
    expect(first.ok && revised.ok).toBe(true);
    if (!first.ok || !revised.ok) return;
    expect(revised.data.submissionId).toBe(first.data.submissionId);

    expect(await gradeSubmission(teacher, first.data.submissionId, { score: "25" })).toMatchObject({ ok: false, code: "INVALID" });
    expect((await gradeSubmission(teacher, first.data.submissionId, { score: "15", feedback: "Clear priorities." })).ok).toBe(true);

    const marked = await db.submission.findUniqueOrThrow({ where: { id: first.data.submissionId } });
    expect(marked).toMatchObject({ status: "GRADED", score: 15, feedback: "Clear priorities.", gradedById: teacher.id });
    const enrollment = await db.enrollment.findFirstOrThrow({ where: { userId: student.id } });
    expect(enrollment.completedAt).not.toBeNull();

    expect(await submitAssignment(student, assignment.id, { response: `${essay} Too late.` })).toMatchObject({
      ok: false,
      code: "CONFLICT",
    });
  });

  it("only lets the course's teacher mark", async () => {
    const { course } = await publishedCourse(0);
    const assignment = await makeAssessment(course.id, { kind: "ASSIGNMENT" });
    const [student, otherTeacher] = await Promise.all([makeStudent(), makeTeacher()]);
    await enroll(student.id, course.id);
    const submitted = await submitAssignment(student, assignment.id, { response: "A response that is long enough." });
    if (!submitted.ok) throw new Error("setup failed");
    expect(await gradeSubmission(otherTeacher, submitted.data.submissionId, { score: 50 })).toMatchObject({
      ok: false,
      code: "NOT_FOUND",
    });
  });

  it("rejects short responses and quiz/assignment mix-ups", async () => {
    const { teacher, course } = await publishedCourse(0);
    const assignment = await makeAssessment(course.id, { kind: "ASSIGNMENT" });
    const quiz = await makeAssessment(course.id);
    const student = await makeStudent();
    await enroll(student.id, course.id);
    expect(await submitAssignment(student, assignment.id, { response: "too short" })).toMatchObject({ ok: false, code: "INVALID" });
    expect(await submitAssignment(student, quiz.id, { response: "A response that is long enough." })).toMatchObject({
      ok: false,
      code: "CONFLICT",
    });
    expect(await submitQuiz(student, assignment.id, {})).toMatchObject({ ok: false, code: "CONFLICT" });

    const attempt = await submitQuiz(student, quiz.id, Object.fromEntries(quiz.questions.map((q) => [q.id, q.options[0].id])));
    if (!attempt.ok) throw new Error("setup failed");
    expect(await gradeSubmission(teacher, attempt.data.submissionId, { score: 1 })).toMatchObject({ ok: false, code: "CONFLICT" });
  });
});
