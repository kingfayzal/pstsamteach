import "server-only";
import { assessmentSchema, questionSchema, type QuestionInput } from "@/lib/validation/assessment";
import { db } from "@/server/db";
import { loadManagedAssessment, loadManagedCourse } from "./guards";
import { type Actor, fail, invalid, notFound, ok, type ServiceResult } from "./result";

function optionRows(input: QuestionInput) {
  return input.options.map((label, index) => ({ label, isCorrect: index === input.correctIndex, position: index + 1 }));
}

export async function createAssessment(actor: Actor, courseId: string, input: unknown): Promise<ServiceResult<{ id: string }>> {
  const guard = await loadManagedCourse(actor, courseId, { requireEditable: true });
  if (!guard.ok) return guard;
  const parsed = assessmentSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const last = await db.assessment.findFirst({ where: { courseId }, orderBy: { position: "desc" }, select: { position: true } });
  const assessment = await db.assessment.create({
    data: { ...parsed.data, courseId, position: (last?.position ?? 0) + 1, isPublished: false },
    select: { id: true },
  });
  return ok(assessment);
}

export async function updateAssessment(actor: Actor, assessmentId: string, input: unknown): Promise<ServiceResult<null>> {
  const guard = await loadManagedAssessment(actor, assessmentId, { requireEditable: true });
  if (!guard.ok) return guard;
  const parsed = assessmentSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { assessment } = guard.data;
  if (parsed.data.kind !== assessment.kind && assessment._count.submissions > 0) {
    return fail("CONFLICT", "Students have already submitted work, so the type can't change.");
  }
  await db.assessment.update({ where: { id: assessmentId }, data: parsed.data });
  return ok(null);
}

export async function deleteAssessment(actor: Actor, assessmentId: string): Promise<ServiceResult<{ courseId: string }>> {
  const guard = await loadManagedAssessment(actor, assessmentId, { requireEditable: true });
  if (!guard.ok) return guard;
  await db.assessment.delete({ where: { id: assessmentId } });
  return ok({ courseId: guard.data.course.id });
}

export async function setAssessmentPublished(actor: Actor, assessmentId: string, published: boolean): Promise<ServiceResult<null>> {
  const guard = await loadManagedAssessment(actor, assessmentId, { requireEditable: true });
  if (!guard.ok) return guard;
  const { assessment } = guard.data;
  if (published && assessment.kind === "QUIZ" && assessment._count.questions === 0) {
    return fail("INVALID", "Add at least one question before publishing this quiz.");
  }
  await db.assessment.update({ where: { id: assessmentId }, data: { isPublished: published } });
  return ok(null);
}

export async function addQuestion(actor: Actor, assessmentId: string, input: unknown): Promise<ServiceResult<{ id: string }>> {
  const guard = await loadManagedAssessment(actor, assessmentId, { requireEditable: true });
  if (!guard.ok) return guard;
  if (guard.data.assessment.kind !== "QUIZ") return fail("CONFLICT", "Only quizzes have questions.");
  const parsed = questionSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const last = await db.question.findFirst({ where: { assessmentId }, orderBy: { position: "desc" }, select: { position: true } });
  const question = await db.question.create({
    data: {
      assessmentId,
      prompt: parsed.data.prompt,
      explanation: parsed.data.explanation,
      position: (last?.position ?? 0) + 1,
      options: { create: optionRows(parsed.data) },
    },
    select: { id: true },
  });
  return ok(question);
}

async function loadQuestion(actor: Actor, questionId: string) {
  const question = await db.question.findUnique({ where: { id: questionId }, select: { id: true, assessmentId: true } });
  if (!question) return notFound("That question");
  const guard = await loadManagedAssessment(actor, question.assessmentId, { requireEditable: true });
  if (!guard.ok) return guard.code === "NOT_FOUND" ? notFound("That question") : guard;
  return ok({ question, ...guard.data });
}

export async function updateQuestion(actor: Actor, questionId: string, input: unknown): Promise<ServiceResult<null>> {
  const guard = await loadQuestion(actor, questionId);
  if (!guard.ok) return guard;
  const parsed = questionSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  await db.$transaction([
    db.questionOption.deleteMany({ where: { questionId } }),
    db.question.update({
      where: { id: questionId },
      data: { prompt: parsed.data.prompt, explanation: parsed.data.explanation, options: { create: optionRows(parsed.data) } },
    }),
  ]);
  return ok(null);
}

export async function deleteQuestion(actor: Actor, questionId: string): Promise<ServiceResult<null>> {
  const guard = await loadQuestion(actor, questionId);
  if (!guard.ok) return guard;
  const { assessment } = guard.data;
  if (assessment.isPublished && assessment._count.questions <= 1) {
    return fail("CONFLICT", "A published quiz needs at least one question. Unpublish it first.");
  }
  await db.$transaction(async (tx) => {
    await tx.question.delete({ where: { id: questionId } });
    const rest = await tx.question.findMany({ where: { assessmentId: assessment.id }, orderBy: { position: "asc" }, select: { id: true } });
    for (const [index, q] of rest.entries()) {
      await tx.question.update({ where: { id: q.id }, data: { position: index + 1 } });
    }
  });
  return ok(null);
}
