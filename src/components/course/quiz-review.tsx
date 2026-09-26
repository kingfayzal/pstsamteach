import { CircledScore, Tick } from "@/components/ui/marks";
import { toPercent } from "@/lib/grading";

type Question = {
  id: string;
  prompt: string;
  explanation: string | null;
  options: { id: string; label: string; isCorrect: boolean }[];
};

function parseAnswers(raw: string | null): Record<string, string> {
  if (!raw) return {};
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return Object.fromEntries(Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === "string"));
  } catch {
    return {};
  }
}

function Cross({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className={`text-danger ${className}`} fill="none">
      <path d="M4 4.5c3.8 3.4 7.6 7.4 12 11.5M15.5 3.5C11.7 7.6 8 11.6 4.5 16" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  );
}

type Props = {
  questions: Question[];
  attempt: { answers: string | null; score: number | null; maxScore: number };
  passPercent: number;
};

/** A marked quiz: the circled score, then each question with the student's answer and the right one. */
export function QuizReview({ questions, attempt, passPercent }: Props) {
  const answers = parseAnswers(attempt.answers);
  const score = attempt.score ?? 0;
  const passed = toPercent(score, attempt.maxScore) >= passPercent;

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-center gap-6 border border-rule bg-sheet px-6 py-5">
        <CircledScore score={score} maxScore={attempt.maxScore} passPercent={passPercent} size="lg" />
        <div>
          <p className={`text-xl font-extrabold ${passed ? "text-tick-text" : "text-danger"}`}>{passed ? "Passed" : "Not passed yet"}</p>
          <p className="text-base text-ink-soft">
            You scored {toPercent(score, attempt.maxScore)}%. The pass mark is {passPercent}%.
          </p>
        </div>
      </div>

      <ol className="space-y-8">
        {questions.map((question, index) => {
          const chosen = answers[question.id];
          const correct = question.options.find((o) => o.isCorrect);
          const gotIt = chosen !== undefined && chosen === correct?.id;
          return (
            <li key={question.id} className="border-b border-rule pb-8">
              <p className="flex gap-3 text-xl font-bold text-ink">
                <span className="figures text-muted">{index + 1}.</span>
                <span className="flex-1">{question.prompt}</span>
                {gotIt ? <Tick className="h-6 w-7 shrink-0" title="Correct" /> : <Cross className="h-6 w-6 shrink-0" />}
              </p>
              <ul className="mt-3 space-y-1.5 pl-7">
                {question.options.map((option) => {
                  const isChosen = option.id === chosen;
                  const tone = option.isCorrect ? "border-tick/40 bg-tick-wash text-tick-text font-bold" : isChosen ? "border-danger/30 bg-danger-wash text-danger" : "border-transparent text-ink-soft";
                  return (
                    <li key={option.id} className={`figures flex items-center justify-between gap-3 rounded-control border px-3 py-2 text-lg ${tone}`}>
                      <span>{option.label}</span>
                      <span className="text-sm">{isChosen ? "Your answer" : option.isCorrect ? "Correct answer" : ""}</span>
                    </li>
                  );
                })}
              </ul>
              {question.explanation ? <p className="mt-3 pl-7 text-base text-ink-soft">{question.explanation}</p> : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
