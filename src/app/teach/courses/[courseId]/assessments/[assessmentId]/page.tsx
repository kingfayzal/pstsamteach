import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AssessmentForm } from "@/components/forms/assessment-form";
import { QuestionForm } from "@/components/forms/question-form";
import { ActionButton } from "@/components/ui/action-button";
import { Pill } from "@/components/ui/badges";
import { EmptyState, Section } from "@/components/ui/layout";
import { Notice } from "@/components/ui/notice";
import { canTeacherEditContent } from "@/lib/course-lifecycle";
import { plural } from "@/lib/format";
import {
  addQuestionAction,
  deleteAssessmentAction,
  deleteQuestionAction,
  publishAssessmentAction,
  updateAssessmentAction,
  updateQuestionAction,
} from "@/server/actions/teaching";
import { requireRole } from "@/server/auth/session";
import { getAssessmentForEditor } from "@/server/queries/teacher";

export const metadata: Metadata = { title: "Edit quiz or assignment" };

export default async function EditAssessmentPage(props: PageProps<"/teach/courses/[courseId]/assessments/[assessmentId]">) {
  const user = await requireRole("TEACHER");
  const [{ courseId, assessmentId }, { notice }] = await Promise.all([props.params, props.searchParams]);
  const assessment = await getAssessmentForEditor(user, courseId, assessmentId);
  if (!assessment) notFound();
  const editable = canTeacherEditContent(assessment.course.status);
  const isQuiz = assessment.kind === "QUIZ";

  return (
    <div className="space-y-14">
      <Notice value={notice} />
      <div className="flex flex-col gap-4 border border-rule bg-sheet px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <p className="text-xl font-extrabold text-ink">{assessment.title}</p>
          <div className="flex flex-wrap items-center gap-3 text-sm text-muted">
            <Pill tone={assessment.isPublished ? "good" : "neutral"}>{assessment.isPublished ? "Visible to students" : "Hidden from students"}</Pill>
            <span>
              {isQuiz ? plural(assessment.questions.length, "question") : `Marked out of ${assessment.maxPoints}`}, {plural(assessment._count.submissions, "submission")}
            </span>
          </div>
        </div>
        {editable ? (
          <ActionButton
            action={publishAssessmentAction.bind(null, courseId, assessment.id, !assessment.isPublished)}
            label={assessment.isPublished ? "Hide from students" : "Publish to students"}
            pendingLabel="Saving…"
            variant={assessment.isPublished ? "secondary" : "primary"}
          />
        ) : null}
      </div>

      {isQuiz ? (
        <Section title="Questions" description="One point per question. Students see the correct answers and your explanations after they submit.">
          {assessment.questions.length === 0 ? (
            <EmptyState title="No questions yet">Add your first question below.</EmptyState>
          ) : (
            <ol className="space-y-4">
              {assessment.questions.map((question, index) => (
                <li key={question.id} className="border border-rule bg-sheet">
                  <details>
                    <summary className="flex cursor-pointer list-none items-baseline gap-3 px-5 py-4 [&::-webkit-details-marker]:hidden">
                      <span className="figures text-sm text-muted">{index + 1}.</span>
                      <span className="flex-1 text-lg font-bold text-ink">{question.prompt}</span>
                      <span className="shrink-0 text-sm text-tick-text">{question.options.find((o) => o.isCorrect)?.label}</span>
                    </summary>
                    <div className="space-y-5 border-t border-rule px-5 py-5">
                      {editable ? (
                        <>
                          <QuestionForm action={updateQuestionAction.bind(null, courseId, question.id)} question={question} submitLabel="Save question" idPrefix={question.id} />
                          <ActionButton
                            action={deleteQuestionAction.bind(null, courseId, question.id)}
                            label="Delete question"
                            pendingLabel="Deleting…"
                            variant="danger"
                            confirm="Delete this question?"
                          />
                        </>
                      ) : (
                        <ul className="space-y-1">
                          {question.options.map((o) => (
                            <li key={o.id} className={o.isCorrect ? "font-bold text-tick-text" : "text-ink-soft"}>
                              {o.label}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </details>
                </li>
              ))}
            </ol>
          )}
          {editable ? (
            <div className="border border-dashed border-rule bg-sheet/60 px-5 py-5">
              <h3 className="mb-4 text-lg text-ink">Add a question</h3>
              <QuestionForm action={addQuestionAction.bind(null, courseId, assessment.id)} submitLabel="Add question" idPrefix="new" />
            </div>
          ) : null}
        </Section>
      ) : null}

      <Section title="Settings">
        {editable ? (
          <AssessmentForm action={updateAssessmentAction.bind(null, courseId, assessment.id)} assessment={assessment} submitLabel="Save settings" />
        ) : (
          <p className="text-base text-muted">Editing is locked while the course is in review or archived.</p>
        )}
      </Section>

      {editable ? (
        <div className="border-t border-rule pt-6">
          <ActionButton
            action={deleteAssessmentAction.bind(null, courseId, assessment.id)}
            label={isQuiz ? "Delete this quiz" : "Delete this assignment"}
            pendingLabel="Deleting…"
            variant="danger"
            confirm="Delete this and every student submission for it? This can't be undone."
          />
        </div>
      ) : null}
    </div>
  );
}
