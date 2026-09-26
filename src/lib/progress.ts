import { toPercent } from "./grading";

export type ProgressInput = {
  lessonIds: readonly string[];
  completedLessonIds: Iterable<string>;
  assessments: readonly { id: string; passed: boolean }[];
};

export type CourseProgress = {
  completedLessons: number;
  totalLessons: number;
  passedAssessments: number;
  totalAssessments: number;
  percent: number;
  isComplete: boolean;
};

export function computeProgress(input: ProgressInput): CourseProgress {
  const completed = new Set(input.completedLessonIds);
  const completedLessons = input.lessonIds.filter((id) => completed.has(id)).length;
  const totalLessons = input.lessonIds.length;
  const passedAssessments = input.assessments.filter((a) => a.passed).length;
  const totalAssessments = input.assessments.length;
  const done = completedLessons + passedAssessments;
  const total = totalLessons + totalAssessments;
  return {
    completedLessons,
    totalLessons,
    passedAssessments,
    totalAssessments,
    percent: toPercent(done, total),
    isComplete: total > 0 && done === total,
  };
}

/** The first lesson (in course order) the student hasn't finished. */
export function nextLessonId(orderedLessonIds: readonly string[], completedLessonIds: Iterable<string>): string | null {
  const completed = new Set(completedLessonIds);
  return orderedLessonIds.find((id) => !completed.has(id)) ?? null;
}

type Attempt = { id: string; score: number | null; maxScore: number; status: "SUBMITTED" | "GRADED" };

/** Highest-scoring graded attempt, by percentage. */
export function bestAttempt<T extends Attempt>(attempts: readonly T[]): T | null {
  const graded = attempts.filter((a) => a.status === "GRADED" && a.score !== null);
  if (graded.length === 0) return null;
  return graded.reduce((best, current) =>
    toPercent(current.score ?? 0, current.maxScore) > toPercent(best.score ?? 0, best.maxScore) ? current : best,
  );
}
