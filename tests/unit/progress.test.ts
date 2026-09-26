import { describe, expect, it } from "vitest";
import { bestAttempt, computeProgress, nextLessonId } from "@/lib/progress";

describe("computeProgress", () => {
  it("counts lessons and passed assessments together", () => {
    const progress = computeProgress({
      lessonIds: ["l1", "l2", "l3"],
      completedLessonIds: ["l1", "l3"],
      assessments: [
        { id: "a1", passed: true },
        { id: "a2", passed: false },
      ],
    });
    expect(progress).toEqual({
      completedLessons: 2,
      totalLessons: 3,
      passedAssessments: 1,
      totalAssessments: 2,
      percent: 60,
      isComplete: false,
    });
  });

  it("ignores completions for lessons no longer in the course", () => {
    const progress = computeProgress({
      lessonIds: ["l1"],
      completedLessonIds: ["l1", "deleted"],
      assessments: [],
    });
    expect(progress.completedLessons).toBe(1);
    expect(progress.isComplete).toBe(true);
    expect(progress.percent).toBe(100);
  });

  it("is never complete when the course is empty", () => {
    const progress = computeProgress({ lessonIds: [], completedLessonIds: [], assessments: [] });
    expect(progress.percent).toBe(0);
    expect(progress.isComplete).toBe(false);
  });
});

describe("nextLessonId", () => {
  it("returns the first lesson not yet completed", () => {
    expect(nextLessonId(["l1", "l2", "l3"], ["l1"])).toBe("l2");
  });

  it("returns null when every lesson is done", () => {
    expect(nextLessonId(["l1"], ["l1"])).toBeNull();
  });
});

describe("bestAttempt", () => {
  it("picks the highest percentage, graded attempts only", () => {
    const best = bestAttempt([
      { id: "s1", score: 3, maxScore: 5, status: "GRADED" as const },
      { id: "s2", score: 9, maxScore: 10, status: "GRADED" as const },
      { id: "s3", score: null, maxScore: 10, status: "SUBMITTED" as const },
    ]);
    expect(best?.id).toBe("s2");
  });

  it("returns null when nothing is graded", () => {
    expect(bestAttempt([{ id: "s1", score: null, maxScore: 10, status: "SUBMITTED" as const }])).toBeNull();
    expect(bestAttempt([])).toBeNull();
  });
});
