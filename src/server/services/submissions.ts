import "server-only";
import { z } from "zod";
import { gradeQuiz, type QuizGrade } from "@/lib/grading";
import { gradeSchema } from "@/lib/validation/assessment";
import { db } from "@/server/db";
import { recordAudit } from "./audit";
import { findActiveEnrollment } from "./enrollment";
import { canManageCourse } from "./guards";
import { syncEnrollmentCompletion } from "./progress-sync";
import { type Actor, fail, forbidden, invalid, isActiveRole, notFound, ok, type ServiceResult } from "./result";

const answersSchema = z.record(z.string().max(64), z.string().max(64));

export const responseSchema = z.object({
  response: z
    .string()
    .trim()
    .min(20, "Write at least 20 characters before submitting.")
    .max(20000, "Keep your response under 20,000 characters."),
});

async function loadOpenAssessment(actor: Actor, assessmentId: string) {
  if (!isActiveRole(actor, "STUDENT")) return forbidden("Only student accounts can submit work.");
  const assessment = await db.assessment.findFirst({
    where: { id: assessmentId, isPublished: true },
    select: { id: true, courseId: true, kind: true, maxPoints: true, passPercent: true, title: true },
  });
  if (!assessment) return notFound("That assessment");
  if (!(await findActiveEnrollment(actor.id, assessment.courseId))) {
    return fail("FORBIDDEN", "Enrol in this course to submit work.");
  }
  return ok(assessment);
}

export async function submitQuiz(
  actor: Actor,
  assessmentId: string,
  rawAnswers: unknown,
): Promise<ServiceResult<{ submissionId: string; grade: QuizGrade }>> {
  const loaded = await loadOpenAssessment(actor, assessmentId);
  if (!loaded.ok) return loaded;
  if (loaded.data.kind !== "QUIZ") return fail("CONFLICT", "This is an assignment, not a quiz.");
  const answers = answersSchema.safeParse(rawAnswers);
  if (!answers.success) return fail("INVALID", "Your answers couldn't be read. Reload the page and try again.");

  const questions = await db.question.findMany({
    where: { assessmentId },
    orderBy: { position: "asc" },
    select: { id: true, options: { select: { id: true, isCorrect: true } } },
  });
  if (questions.length === 0) return fail("CONFLICT", "This quiz has no questions yet.");
  const unanswered = questions.filter((q) => !answers.data[q.id]).length;
  if (unanswered > 0) {
    return fail("INVALID", `Answer every question before submitting. ${unanswered} left.`);
  }

  const grade = gradeQuiz(questions, answers.data);
  const submission = await db.submission.create({
    data: {
      assessmentId,
      studentId: actor.id,
      answers: JSON.stringify(answers.data),
      score: grade.score,
      maxScore: grade.maxScore,
      status: "GRADED",
      gradedAt: new Date(),
    },
    select: { id: true },
  });
  await syncEnrollmentCompletion(db, actor.id, loaded.data.courseId);
  return ok({ submissionId: submission.id, grade });
}

export async function submitAssignment(actor: Actor, assessmentId: string, input: unknown): Promise<ServiceResult<{ submissionId: string }>> {
  const loaded = await loadOpenAssessment(actor, assessmentId);
  if (!loaded.ok) return loaded;
  if (loaded.data.kind !== "ASSIGNMENT") return fail("CONFLICT", "This is a quiz, not an assignment.");
  const parsed = responseSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);

  const existing = await db.submission.findFirst({
    where: { assessmentId, studentId: actor.id },
    select: { id: true, status: true },
  });
  if (existing?.status === "GRADED") {
    return fail("CONFLICT", "Your teacher has already marked this work, so it can't be changed.");
  }
  const submission = existing
    ? await db.submission.update({
        where: { id: existing.id },
        data: { response: parsed.data.response, submittedAt: new Date() },
        select: { id: true },
      })
    : await db.submission.create({
        data: { assessmentId, studentId: actor.id, response: parsed.data.response, maxScore: loaded.data.maxPoints },
        select: { id: true },
      });
  return ok({ submissionId: submission.id });
}

export async function gradeSubmission(actor: Actor, submissionId: string, input: unknown): Promise<ServiceResult<null>> {
  const submission = await db.submission.findUnique({
    where: { id: submissionId },
    select: {
      id: true,
      studentId: true,
      maxScore: true,
      assessment: { select: { kind: true, title: true, courseId: true, course: { select: { teacherId: true } } } },
    },
  });
  if (!submission || !canManageCourse(actor, submission.assessment.course)) return notFound("That submission");
  if (submission.assessment.kind !== "ASSIGNMENT") return fail("CONFLICT", "Quizzes are marked automatically.");

  const parsed = gradeSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  if (parsed.data.score > submission.maxScore) {
    const message = `The score can't be more than ${submission.maxScore}.`;
    return fail("INVALID", message, { score: [message] });
  }

  await db.$transaction(async (tx) => {
    await tx.submission.update({
      where: { id: submissionId },
      data: { score: parsed.data.score, feedback: parsed.data.feedback, status: "GRADED", gradedById: actor.id, gradedAt: new Date() },
    });
    await syncEnrollmentCompletion(tx, submission.studentId, submission.assessment.courseId);
    await recordAudit(tx, {
      actorId: actor.id,
      action: "submission.grade",
      entity: "submission",
      entityId: submissionId,
      summary: `Marked ${submission.assessment.title}: ${parsed.data.score}/${submission.maxScore}`,
    });
  });
  return ok(null);
}
