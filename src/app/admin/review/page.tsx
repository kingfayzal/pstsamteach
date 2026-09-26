import type { Metadata } from "next";
import Link from "next/link";
import { ActionButton } from "@/components/ui/action-button";
import { SubjectTag } from "@/components/ui/badges";
import { EmptyState, PageHeader, Section } from "@/components/ui/layout";
import { formatRelative, plural } from "@/lib/format";
import { approveTeacherAction, declineTeacherAction } from "@/server/actions/admin";
import { requireRole } from "@/server/auth/session";
import { getReviewQueue } from "@/server/queries/admin";

export const metadata: Metadata = { title: "Review queue" };

export default async function ReviewQueuePage() {
  await requireRole("ADMIN");
  const { courses, applicants } = await getReviewQueue();

  return (
    <>
      <PageHeader title="Review queue" description="Courses waiting to go live, and people who want to teach. Oldest first." />
      <div className="space-y-14">
        <Section title={`Courses (${courses.length})`}>
          {courses.length === 0 ? (
            <EmptyState title="No courses waiting">When a teacher submits a course, it appears here for you to approve or send back.</EmptyState>
          ) : (
            <ul className="divide-y divide-rule border-y border-rule">
              {courses.map((c) => (
                <li key={c.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 space-y-1">
                    <SubjectTag name={c.subject.name} color={c.subject.color} />
                    <p className="text-lg font-bold text-ink">{c.title}</p>
                    <p className="text-sm text-muted">
                      {c.teacher.name}, {plural(c._count.lessons, "lesson")}, {plural(c._count.assessments, "quiz or assignment", "quizzes or assignments")}. Submitted{" "}
                      {c.submittedAt ? formatRelative(c.submittedAt) : ""}.
                    </p>
                  </div>
                  <Link href={`/admin/courses/${c.id}`} className="shrink-0 rounded-control bg-ink px-3 py-2 text-sm font-bold text-paper hover:bg-ink-deep">
                    Review course
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title={`Teacher applications (${applicants.length})`}>
          {applicants.length === 0 ? (
            <EmptyState title="No applications waiting" />
          ) : (
            <ul className="space-y-4">
              {applicants.map((a) => (
                <li key={a.id} className="border border-rule bg-sheet px-5 py-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <div>
                      <Link href={`/admin/people/${a.id}`} className="text-lg font-bold text-ink hover:underline hover:decoration-rule hover:underline-offset-4">
                        {a.name}
                      </Link>
                      <p className="text-sm text-muted">{a.email}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      {a.applicationSubject ? <SubjectTag name={a.applicationSubject.name} color={a.applicationSubject.color} /> : null}
                      <span className="text-sm text-muted">Applied {formatRelative(a.createdAt)}</span>
                    </div>
                  </div>
                  {a.applicationNote ? <p className="mt-3 max-w-[70ch] border-l-2 border-rule pl-4 text-base whitespace-pre-line text-ink-soft">{a.applicationNote}</p> : null}
                  <div className="mt-4 flex flex-wrap gap-3">
                    <ActionButton action={approveTeacherAction.bind(null, a.id)} label="Approve as teacher" pendingLabel="Approving…" variant="primary" />
                    <ActionButton
                      action={declineTeacherAction.bind(null, a.id)}
                      label="Decline"
                      pendingLabel="Declining…"
                      variant="danger"
                      confirm="Decline this application? Their account will become a student account."
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </>
  );
}
