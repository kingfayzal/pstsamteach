import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { changeCourseStatus, createCourse, setCourseFeatured, updateCourse } from "@/server/services/courses";
import { createLesson, deleteLesson, moveLesson, updateLesson } from "@/server/services/lessons";
import {
  addQuestion,
  createAssessment,
  deleteAssessment,
  deleteQuestion,
  setAssessmentPublished,
  updateAssessment,
  updateQuestion,
} from "@/server/services/assessments";
import { makeAdmin, makeAssessment, makeCourse, makeStudent, makeSubject, makeTeacher, makeUser, resetDb } from "./factories";

beforeEach(resetDb);

const courseInput = (subjectId: string) => ({
  title: "Algebra from the ground up",
  summary: "Solve linear equations with confidence.",
  description: "A course description.",
  subjectId,
  level: "FOUNDATION",
});

describe("createCourse", () => {
  it("creates a draft owned by the teacher with a unique slug", async () => {
    const [teacher, subject] = await Promise.all([makeTeacher(), makeSubject()]);
    const first = await createCourse(teacher, courseInput(subject.id));
    const second = await createCourse(teacher, courseInput(subject.id));
    expect(first.ok && second.ok).toBe(true);
    if (first.ok && second.ok) {
      expect(first.data.slug).toBe("algebra-from-the-ground-up");
      expect(second.data.slug).not.toBe(first.data.slug);
      const course = await db.course.findUniqueOrThrow({ where: { id: first.data.id } });
      expect(course).toMatchObject({ status: "DRAFT", teacherId: teacher.id });
    }
  });

  it("refuses students and pending teachers", async () => {
    const subject = await makeSubject();
    const student = await makeStudent();
    const pending = await makeUser({ role: "TEACHER", status: "PENDING" });
    expect((await createCourse(student, courseInput(subject.id))).ok).toBe(false);
    expect((await createCourse(pending, courseInput(subject.id))).ok).toBe(false);
  });

  it("refuses closed subjects", async () => {
    const [teacher, subject] = await Promise.all([makeTeacher(), makeSubject({ isActive: false })]);
    expect(await createCourse(teacher, courseInput(subject.id))).toMatchObject({ ok: false, code: "INVALID" });
  });

  it("returns field errors for bad input", async () => {
    const teacher = await makeTeacher();
    const result = await createCourse(teacher, { title: "x" });
    expect(result).toMatchObject({ ok: false, code: "INVALID" });
  });
});

describe("updateCourse", () => {
  it("lets the owner edit but hides the course from other teachers", async () => {
    const [owner, other, subject] = await Promise.all([makeTeacher(), makeTeacher(), makeSubject()]);
    const course = await makeCourse(owner.id, subject.id);
    expect((await updateCourse(owner, course.id, { ...courseInput(subject.id), title: "Renamed course" })).ok).toBe(true);
    expect(await updateCourse(other, course.id, courseInput(subject.id))).toMatchObject({ ok: false, code: "NOT_FOUND" });
  });

  it("locks edits while in review", async () => {
    const [owner, subject] = await Promise.all([makeTeacher(), makeSubject()]);
    const course = await makeCourse(owner.id, subject.id, { status: "IN_REVIEW" });
    expect(await updateCourse(owner, course.id, courseInput(subject.id))).toMatchObject({ ok: false, code: "CONFLICT" });
  });
});

describe("changeCourseStatus", () => {
  it("runs the full review cycle and records it in the audit log", async () => {
    const [teacher, admin, subject] = await Promise.all([makeTeacher(), makeAdmin(), makeSubject()]);
    const course = await makeCourse(teacher.id, subject.id);

    expect(await changeCourseStatus(teacher, course.id, "submit")).toMatchObject({ ok: true, data: { status: "IN_REVIEW" } });
    expect(await changeCourseStatus(admin, course.id, "reject", { note: "Add a worked example to lesson two." })).toMatchObject({
      ok: true,
    });
    const rejected = await db.course.findUniqueOrThrow({ where: { id: course.id } });
    expect(rejected).toMatchObject({ status: "DRAFT", reviewNote: "Add a worked example to lesson two." });

    await changeCourseStatus(teacher, course.id, "submit");
    expect(await changeCourseStatus(admin, course.id, "approve")).toMatchObject({ ok: true, data: { status: "PUBLISHED" } });
    const published = await db.course.findUniqueOrThrow({ where: { id: course.id } });
    expect(published.publishedAt).not.toBeNull();
    expect(published.reviewNote).toBeNull();

    expect(await db.auditLog.count({ where: { entityId: course.id } })).toBe(4);
  });

  it("blocks submitting an empty course", async () => {
    const [teacher, subject] = await Promise.all([makeTeacher(), makeSubject()]);
    const course = await makeCourse(teacher.id, subject.id, { lessons: 0, description: "short" });
    const result = await changeCourseStatus(teacher, course.id, "submit");
    expect(result).toMatchObject({ ok: false, code: "INVALID" });
  });

  it("requires a note to send a course back", async () => {
    const [teacher, admin, subject] = await Promise.all([makeTeacher(), makeAdmin(), makeSubject()]);
    const course = await makeCourse(teacher.id, subject.id, { status: "IN_REVIEW" });
    expect(await changeCourseStatus(admin, course.id, "reject", { note: "" })).toMatchObject({ ok: false, code: "INVALID" });
  });

  it("stops teachers approving their own work", async () => {
    const [teacher, subject] = await Promise.all([makeTeacher(), makeSubject()]);
    const course = await makeCourse(teacher.id, subject.id, { status: "IN_REVIEW" });
    expect(await changeCourseStatus(teacher, course.id, "approve")).toMatchObject({ ok: false, code: "CONFLICT" });
  });

  it("clears featured when archiving", async () => {
    const [teacher, admin, subject] = await Promise.all([makeTeacher(), makeAdmin(), makeSubject()]);
    const course = await makeCourse(teacher.id, subject.id, { status: "PUBLISHED" });
    expect((await setCourseFeatured(admin, course.id, true)).ok).toBe(true);
    await changeCourseStatus(admin, course.id, "archive");
    const row = await db.course.findUniqueOrThrow({ where: { id: course.id } });
    expect(row).toMatchObject({ status: "ARCHIVED", isFeatured: false });
    expect(await setCourseFeatured(admin, course.id, true)).toMatchObject({ ok: false, code: "CONFLICT" });
    expect(await setCourseFeatured(teacher, course.id, true)).toMatchObject({ ok: false, code: "FORBIDDEN" });
  });
});

describe("lessons", () => {
  it("appends, edits, reorders and deletes lessons, keeping positions contiguous", async () => {
    const [teacher, subject] = await Promise.all([makeTeacher(), makeSubject()]);
    const course = await makeCourse(teacher.id, subject.id, { lessons: 2 });
    const created = await createLesson(teacher, course.id, { title: "Third", body: "Content", durationMinutes: "15" });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    expect((await updateLesson(teacher, created.data.id, { title: "Third, edited", body: "More", durationMinutes: "20" })).ok).toBe(true);
    await moveLesson(teacher, created.data.id, "up");
    await moveLesson(teacher, course.lessons[0].id, "up"); // already first: no-op

    const ordered = await db.lesson.findMany({ where: { courseId: course.id }, orderBy: { position: "asc" } });
    expect(ordered.map((l) => l.title)).toEqual(["Lesson 1", "Third, edited", "Lesson 2"]);

    await deleteLesson(teacher, ordered[0].id);
    const after = await db.lesson.findMany({ where: { courseId: course.id }, orderBy: { position: "asc" } });
    expect(after.map((l) => l.position)).toEqual([1, 2]);
  });

  it("won't delete the last lesson of a published course", async () => {
    const [teacher, subject] = await Promise.all([makeTeacher(), makeSubject()]);
    const course = await makeCourse(teacher.id, subject.id, { lessons: 1, status: "PUBLISHED" });
    expect(await deleteLesson(teacher, course.lessons[0].id)).toMatchObject({ ok: false, code: "CONFLICT" });
  });

  it("hides lessons from other teachers", async () => {
    const [teacher, other, subject] = await Promise.all([makeTeacher(), makeTeacher(), makeSubject()]);
    const course = await makeCourse(teacher.id, subject.id);
    expect(await updateLesson(other, course.lessons[0].id, { title: "Hijack", body: "x", durationMinutes: 1 })).toMatchObject({
      ok: false,
      code: "NOT_FOUND",
    });
    expect(await deleteLesson(other, "missing")).toMatchObject({ ok: false, code: "NOT_FOUND" });
  });
});

describe("assessments and questions", () => {
  it("builds a quiz, refuses to publish it empty, then publishes", async () => {
    const [teacher, subject] = await Promise.all([makeTeacher(), makeSubject()]);
    const course = await makeCourse(teacher.id, subject.id);
    const quiz = await createAssessment(teacher, course.id, { title: "Quiz", instructions: "Go", kind: "QUIZ" });
    expect(quiz.ok).toBe(true);
    if (!quiz.ok) return;

    expect(await setAssessmentPublished(teacher, quiz.data.id, true)).toMatchObject({ ok: false, code: "INVALID" });
    const question = await addQuestion(teacher, quiz.data.id, { prompt: "5 x 4 = ?", options: ["9", "20", ""], correctIndex: "1" });
    expect(question.ok).toBe(true);
    expect((await setAssessmentPublished(teacher, quiz.data.id, true)).ok).toBe(true);

    if (question.ok) {
      expect(await deleteQuestion(teacher, question.data.id)).toMatchObject({ ok: false, code: "CONFLICT" });
      expect((await updateQuestion(teacher, question.data.id, { prompt: "5 x 5 = ?", options: ["25", "10"], correctIndex: "0" })).ok).toBe(true);
      const options = await db.questionOption.findMany({ where: { questionId: question.data.id }, orderBy: { position: "asc" } });
      expect(options.map((o) => [o.label, o.isCorrect])).toEqual([["25", true], ["10", false]]);
    }
  });

  it("refuses questions on assignments and kind changes after submissions", async () => {
    const [teacher, student, subject] = await Promise.all([makeTeacher(), makeStudent(), makeSubject()]);
    const course = await makeCourse(teacher.id, subject.id);
    const assignment = await makeAssessment(course.id, { kind: "ASSIGNMENT" });
    expect(await addQuestion(teacher, assignment.id, { prompt: "Q?", options: ["a", "b"], correctIndex: 0 })).toMatchObject({
      ok: false,
      code: "CONFLICT",
    });
    await db.submission.create({ data: { assessmentId: assignment.id, studentId: student.id, maxScore: 100, response: "x" } });
    const change = await updateAssessment(teacher, assignment.id, { title: "Care plan", instructions: "Write it.", kind: "QUIZ" });
    expect(change).toMatchObject({ ok: false, code: "CONFLICT" });
  });

  it("deletes an assessment and hides it from others", async () => {
    const [teacher, other, subject] = await Promise.all([makeTeacher(), makeTeacher(), makeSubject()]);
    const course = await makeCourse(teacher.id, subject.id);
    const quiz = await makeAssessment(course.id);
    expect(await deleteAssessment(other, quiz.id)).toMatchObject({ ok: false, code: "NOT_FOUND" });
    expect(await deleteAssessment(teacher, quiz.id)).toMatchObject({ ok: true, data: { courseId: course.id } });
  });
});
