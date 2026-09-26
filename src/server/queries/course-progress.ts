import "server-only";
import type { AssessmentKind, SubmissionStatus } from "@/generated/prisma/enums";
import { isPassing } from "@/lib/grading";
import { bestAttempt, computeProgress, type CourseProgress, nextLessonId } from "@/lib/progress";

type AttemptRow = {
  id: string;
  score: number | null;
  maxScore: number;
  status: SubmissionStatus;
  submittedAt: Date;
  feedback: string | null;
};

type AssessmentRow = {
  id: string;
  title: string;
  kind: AssessmentKind;
  passPercent: number;
  dueAt: Date | null;
  submissions: AttemptRow[];
};

export type AssessmentState = "todo" | "awaiting" | "passed" | "retry";

export type AssessmentSummary = Omit<AssessmentRow, "submissions"> & {
  state: AssessmentState;
  best: AttemptRow | null;
  latest: AttemptRow | null;
  attempts: number;
};

/** Prisma select for the pieces of a course needed to work out a student's progress. */
export function progressSelect(userId: string) {
  return {
    lessons: { orderBy: { position: "asc" as const }, select: { id: true, title: true, durationMinutes: true } },
    assessments: {
      where: { isPublished: true },
      orderBy: { position: "asc" as const },
      select: {
        id: true,
        title: true,
        kind: true,
        passPercent: true,
        dueAt: true,
        submissions: {
          where: { studentId: userId },
          orderBy: { submittedAt: "desc" as const },
          select: { id: true, score: true, maxScore: true, status: true, submittedAt: true, feedback: true },
        },
      },
    },
  };
}

function summarizeAssessment(assessment: AssessmentRow): AssessmentSummary {
  const { submissions, ...rest } = assessment;
  const best = bestAttempt(submissions);
  const latest = submissions[0] ?? null;
  const passed = best !== null && isPassing(best.score ?? 0, best.maxScore, assessment.passPercent);
  const state: AssessmentState = passed ? "passed" : latest?.status === "SUBMITTED" ? "awaiting" : latest ? "retry" : "todo";
  return { ...rest, state, best, latest, attempts: submissions.length };
}

export type CourseSummary = {
  progress: CourseProgress;
  nextLessonId: string | null;
  assessments: AssessmentSummary[];
  completedLessonIds: Set<string>;
};

export function summarizeCourse(
  course: { lessons: { id: string }[]; assessments: AssessmentRow[] },
  completedLessonIds: Iterable<string>,
): CourseSummary {
  const completed = new Set(completedLessonIds);
  const assessments = course.assessments.map(summarizeAssessment);
  const lessonIds = course.lessons.map((l) => l.id);
  return {
    progress: computeProgress({
      lessonIds,
      completedLessonIds: completed,
      assessments: assessments.map((a) => ({ id: a.id, passed: a.state === "passed" })),
    }),
    nextLessonId: nextLessonId(lessonIds, completed),
    assessments,
    completedLessonIds: completed,
  };
}
