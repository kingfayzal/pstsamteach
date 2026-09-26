import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Markdown } from "@/components/course/markdown";
import { GradeForm } from "@/components/forms/simple-forms";
import { PageHeader, Section } from "@/components/ui/layout";
import { formatDateTime } from "@/lib/format";
import { gradeSubmissionAction } from "@/server/actions/teaching";
import { requireRole } from "@/server/auth/session";
import { getSubmissionForMarking } from "@/server/queries/teacher";

export const metadata: Metadata = { title: "Mark work" };

export default async function MarkSubmissionPage(props: PageProps<"/teach/marking/[submissionId]">) {
  const user = await requireRole("TEACHER");
  const { submissionId } = await props.params;
  const submission = await getSubmissionForMarking(user, submissionId);
  if (!submission || submission.assessment.kind !== "ASSIGNMENT") notFound();

  return (
    <>
      <PageHeader
        crumbs={[{ href: "/teach/marking", label: "Marking" }]}
        title={`${submission.student.name}: ${submission.assessment.title}`}
        description={`${submission.assessment.course.title}. Handed in ${formatDateTime(submission.submittedAt)}.`}
      />
      <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-10">
          <details className="border border-rule bg-sheet px-5 py-4">
            <summary className="cursor-pointer text-base font-bold text-ink">The task you set</summary>
            <div className="mt-4">
              <Markdown className="prose-lesson text-base">{submission.assessment.instructions}</Markdown>
            </div>
          </details>
          <Section title="Their answer">
            <div className="ruled border border-rule px-6 py-8 pl-[4.5rem]">
              <p className="text-lg leading-8 whitespace-pre-line text-ink">{submission.response}</p>
            </div>
          </Section>
        </div>
        <aside className="space-y-4 lg:sticky lg:top-10 lg:self-start">
          <h2 className="text-xl text-ink">{submission.status === "GRADED" ? "Marked" : "Your mark"}</h2>
          {submission.status === "GRADED" && submission.gradedAt ? (
            <p className="text-sm text-muted">
              Marked {formatDateTime(submission.gradedAt)}
              {submission.gradedBy ? ` by ${submission.gradedBy.name}` : ""}. You can change it.
            </p>
          ) : (
            <p className="text-sm text-muted">Pass mark is {submission.assessment.passPercent}%.</p>
          )}
          <GradeForm action={gradeSubmissionAction.bind(null, submission.id)} maxScore={submission.maxScore} existing={{ score: submission.score, feedback: submission.feedback }} />
        </aside>
      </div>
    </>
  );
}
