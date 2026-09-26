import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Markdown } from "@/components/course/markdown";
import { QuizReview } from "@/components/course/quiz-review";
import { AssignmentForm } from "@/components/forms/assignment-form";
import { QuizForm, type QuizQuestionView } from "@/components/forms/quiz-form";
import { LinkButton } from "@/components/ui/button";
import { PageHeader, Section } from "@/components/ui/layout";
import { CircledScore, TeacherNote } from "@/components/ui/marks";
import { formatDate, formatDateTime, plural } from "@/lib/format";
import { toPercent } from "@/lib/grading";
import { submitAssignmentAction, submitQuizAction } from "@/server/actions/learning";
import { requireRole } from "@/server/auth/session";
import { getStudentAssessment } from "@/server/queries/student";

export const metadata: Metadata = { title: "Assessment" };

type Assessment = NonNullable<Awaited<ReturnType<typeof getStudentAssessment>>>;

function QuizSection({ assessment, attemptId, retake }: { assessment: Assessment; attemptId?: string; retake: boolean }) {
  const base = `/learn/courses/${assessment.course.slug}/assessments/${assessment.id}`;
  const attempts = assessment.submissions;
  const shown = attemptId ? attempts.find((a) => a.id === attemptId) : attempts[0];
  const closed = assessment.course.status === "ARCHIVED";

  if ((retake || !shown) && !closed) {
    const questions: QuizQuestionView[] = assessment.questions.map((q) => ({
      id: q.id,
      prompt: q.prompt,
      options: q.options.map((o) => ({ id: o.id, label: o.label })),
    }));
    return <QuizForm questions={questions} action={submitQuizAction.bind(null, assessment.id, assessment.course.slug)} />;
  }
  if (!shown) return <p className="text-base text-muted">This course is archived, so the quiz is closed.</p>;

  return (
    <div className="space-y-10">
      <QuizReview questions={assessment.questions} attempt={shown} passPercent={assessment.passPercent} />
      <div className="flex flex-wrap items-center gap-4">
        {!closed ? <LinkButton href={`${base}?retake=1`}>Try again</LinkButton> : null}
        <LinkButton href={`/learn/courses/${assessment.course.slug}`} variant="secondary">
          Back to the course
        </LinkButton>
      </div>
      {attempts.length > 1 ? (
        <Section title="Your attempts">
          <ul className="divide-y divide-rule border-y border-rule">
            {attempts.map((a, i) => (
              <li key={a.id} className="flex items-center justify-between gap-4 py-2.5">
                <Link href={`${base}?attempt=${a.id}`} aria-current={a.id === shown.id ? "true" : undefined} className="text-base text-ink underline decoration-rule underline-offset-4 aria-[current]:font-bold">
                  Attempt {attempts.length - i}, {formatDateTime(a.submittedAt)}
                </Link>
                <span className="figures text-base font-bold text-ink-soft">
                  {a.score}/{a.maxScore} ({toPercent(a.score ?? 0, a.maxScore)}%)
                </span>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
    </div>
  );
}

function AssignmentSection({ assessment }: { assessment: Assessment }) {
  const submission = assessment.submissions[0];
  if (submission?.status === "GRADED") {
    return (
      <div className="space-y-10">
        <div className="flex flex-wrap items-center gap-6 border border-rule bg-sheet px-6 py-5">
          <CircledScore score={submission.score ?? 0} maxScore={submission.maxScore} passPercent={assessment.passPercent} size="lg" />
          <p className="text-base text-ink-soft">Marked {formatDate(submission.gradedAt)}. The pass mark is {assessment.passPercent}%.</p>
        </div>
        {submission.feedback ? <TeacherNote author="Your teacher's feedback">{submission.feedback}</TeacherNote> : null}
        <Section title="What you handed in">
          <p className="max-w-[68ch] border-l-2 border-rule pl-4 text-lg whitespace-pre-line text-ink-soft">{submission.response}</p>
        </Section>
      </div>
    );
  }
  if (assessment.course.status === "ARCHIVED" && !submission) {
    return <p className="text-base text-muted">This course is archived, so the assignment is closed.</p>;
  }
  return (
    <div className="space-y-4">
      {submission ? (
        <p className="border border-amber/30 bg-amber-wash px-4 py-3 text-base font-bold text-amber">
          Handed in {formatDateTime(submission.submittedAt)}. Waiting for your teacher to mark it. You can still change your answer until then.
        </p>
      ) : null}
      <AssignmentForm action={submitAssignmentAction.bind(null, assessment.id, assessment.course.slug)} existing={submission?.response ?? null} />
    </div>
  );
}

export default async function AssessmentPage(props: PageProps<"/learn/courses/[slug]/assessments/[assessmentId]">) {
  const user = await requireRole("STUDENT");
  const [{ slug, assessmentId }, searchParams] = await Promise.all([props.params, props.searchParams]);
  const assessment = await getStudentAssessment(user.id, slug, assessmentId);
  if (!assessment) notFound();
  const attempt = typeof searchParams.attempt === "string" ? searchParams.attempt : undefined;
  const retake = searchParams.retake === "1";
  const isQuiz = assessment.kind === "QUIZ";

  return (
    <>
      <PageHeader
        crumbs={[
          { href: "/learn/courses", label: "My courses" },
          { href: `/learn/courses/${assessment.course.slug}`, label: assessment.course.title },
        ]}
        title={assessment.title}
        meta={
          <p className="text-sm text-muted">
            {isQuiz
              ? `Quiz, ${plural(assessment.questions.length, "question")}, marked the moment you submit. Pass mark ${assessment.passPercent}%.`
              : `Assignment, marked by your teacher out of ${assessment.maxPoints}. Pass mark ${assessment.passPercent}%.`}
            {assessment.dueAt ? ` Due ${formatDate(assessment.dueAt)}.` : ""}
          </p>
        }
      />
      <div className="mb-10">
        <Markdown>{assessment.instructions}</Markdown>
      </div>
      {isQuiz ? <QuizSection assessment={assessment} attemptId={attempt} retake={retake} /> : <AssignmentSection assessment={assessment} />}
    </>
  );
}
