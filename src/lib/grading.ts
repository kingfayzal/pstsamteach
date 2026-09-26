export type GradableOption = { readonly id: string; readonly isCorrect: boolean };
export type GradableQuestion = { readonly id: string; readonly options: readonly GradableOption[] };
export type QuizAnswers = Readonly<Record<string, string>>;

export type QuestionResult = {
  questionId: string;
  chosenOptionId: string | null;
  correctOptionId: string | null;
  isCorrect: boolean;
};

export type QuizGrade = {
  score: number;
  maxScore: number;
  percent: number;
  results: QuestionResult[];
};

/** Whole-number percentage, clamped to 0..100. Zero when nothing is available. */
export function toPercent(score: number, maxScore: number): number {
  if (maxScore <= 0) return 0;
  const raw = Math.round((score / maxScore) * 100);
  return Math.min(100, Math.max(0, raw));
}

export function isPassing(score: number, maxScore: number, passPercent: number): boolean {
  if (maxScore <= 0) return false;
  return toPercent(score, maxScore) >= passPercent;
}

function gradeQuestion(question: GradableQuestion, answers: QuizAnswers): QuestionResult {
  const chosen = answers[question.id];
  const chosenOption = question.options.find((option) => option.id === chosen) ?? null;
  const correctOption = question.options.find((option) => option.isCorrect) ?? null;
  return {
    questionId: question.id,
    chosenOptionId: chosenOption?.id ?? null,
    correctOptionId: correctOption?.id ?? null,
    isCorrect: Boolean(chosenOption?.isCorrect),
  };
}

/** Auto-mark a multiple-choice quiz: one point per correct answer. */
export function gradeQuiz(questions: readonly GradableQuestion[], answers: QuizAnswers): QuizGrade {
  const results = questions.map((question) => gradeQuestion(question, answers));
  const score = results.filter((result) => result.isCorrect).length;
  const maxScore = questions.length;
  return { score, maxScore, percent: toPercent(score, maxScore), results };
}
