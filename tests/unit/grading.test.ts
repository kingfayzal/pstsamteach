import { describe, expect, it } from "vitest";
import { gradeQuiz, isPassing, toPercent } from "@/lib/grading";

const questions = [
  { id: "q1", options: [{ id: "a", isCorrect: false }, { id: "b", isCorrect: true }] },
  { id: "q2", options: [{ id: "c", isCorrect: true }, { id: "d", isCorrect: false }] },
  { id: "q3", options: [{ id: "e", isCorrect: false }, { id: "f", isCorrect: true }] },
];

describe("gradeQuiz", () => {
  it("scores one point per correct answer", () => {
    const grade = gradeQuiz(questions, { q1: "b", q2: "c", q3: "e" });
    expect(grade.score).toBe(2);
    expect(grade.maxScore).toBe(3);
    expect(grade.percent).toBe(67);
  });

  it("reports per-question results with the correct option", () => {
    const grade = gradeQuiz(questions, { q1: "a" });
    expect(grade.results[0]).toEqual({
      questionId: "q1",
      chosenOptionId: "a",
      correctOptionId: "b",
      isCorrect: false,
    });
    expect(grade.results[1]).toMatchObject({ chosenOptionId: null, isCorrect: false });
  });

  it("treats an option from another question as unanswered", () => {
    const grade = gradeQuiz(questions, { q1: "c" });
    expect(grade.results[0]).toMatchObject({ chosenOptionId: null, isCorrect: false });
    expect(grade.score).toBe(0);
  });

  it("ignores answers for questions that are not in the quiz", () => {
    const grade = gradeQuiz(questions, { q9: "b", q1: "b" });
    expect(grade.score).toBe(1);
    expect(grade.results).toHaveLength(3);
  });

  it("handles a quiz with no questions", () => {
    const grade = gradeQuiz([], {});
    expect(grade).toEqual({ score: 0, maxScore: 0, percent: 0, results: [] });
  });

  it("does not mutate the inputs", () => {
    const answers = Object.freeze({ q1: "b" });
    const frozen = Object.freeze(questions.map((q) => Object.freeze({ ...q })));
    expect(() => gradeQuiz(frozen, answers)).not.toThrow();
  });
});

describe("toPercent", () => {
  it("rounds to the nearest whole percent", () => {
    expect(toPercent(1, 3)).toBe(33);
    expect(toPercent(2, 3)).toBe(67);
    expect(toPercent(45, 50)).toBe(90);
  });

  it("returns 0 when nothing is available", () => {
    expect(toPercent(0, 0)).toBe(0);
  });

  it("clamps to 0..100", () => {
    expect(toPercent(120, 100)).toBe(100);
    expect(toPercent(-5, 100)).toBe(0);
  });
});

describe("isPassing", () => {
  it("passes at or above the threshold", () => {
    expect(isPassing(6, 10, 60)).toBe(true);
    expect(isPassing(59, 100, 60)).toBe(false);
  });

  it("never passes an empty assessment", () => {
    expect(isPassing(0, 0, 0)).toBe(false);
  });
});
