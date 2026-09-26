import "server-only";
import { isPassing } from "@/lib/grading";
import { bestAttempt, computeProgress, type CourseProgress } from "@/lib/progress";
import type { Db, Tx } from "@/server/db";

/** Recompute a student's progress in a course and stamp or clear `completedAt`. */
export async function syncEnrollmentCompletion(client: Db | Tx, userId: string, courseId: string): Promise<CourseProgress | null> {
  const enrollment = await client.enrollment.findUnique({
    where: { userId_courseId: { userId, courseId } },
    select: { id: true, completedAt: true },
  });
  if (!enrollment) return null;

  const [lessons, completed, assessments] = await Promise.all([
    client.lesson.findMany({ where: { courseId }, select: { id: true } }),
    client.lessonProgress.findMany({ where: { userId, lesson: { courseId } }, select: { lessonId: true } }),
    client.assessment.findMany({
      where: { courseId, isPublished: true },
      select: {
        id: true,
        passPercent: true,
        submissions: { where: { studentId: userId }, select: { id: true, score: true, maxScore: true, status: true } },
      },
    }),
  ]);

  const progress = computeProgress({
    lessonIds: lessons.map((l) => l.id),
    completedLessonIds: completed.map((c) => c.lessonId),
    assessments: assessments.map((a) => {
      const best = bestAttempt(a.submissions);
      return { id: a.id, passed: best !== null && isPassing(best.score ?? 0, best.maxScore, a.passPercent) };
    }),
  });

  const shouldBeComplete = progress.isComplete;
  if (shouldBeComplete !== (enrollment.completedAt !== null)) {
    await client.enrollment.update({
      where: { id: enrollment.id },
      data: { completedAt: shouldBeComplete ? new Date() : null },
    });
  }
  return progress;
}
