import type { Metadata } from "next";
import { LinkButton } from "@/components/ui/button";
import { EmptyState, PageHeader, Section } from "@/components/ui/layout";
import { CircledScore } from "@/components/ui/marks";
import { Notice } from "@/components/ui/notice";
import { formatDate, formatRelative } from "@/lib/format";
import { requireRole } from "@/server/auth/session";
import { getMarkingQueue, getRecentlyMarked } from "@/server/queries/teacher";

export const metadata: Metadata = { title: "Marking" };

export default async function MarkingPage(props: PageProps<"/teach/marking">) {
  const user = await requireRole("TEACHER");
  const [{ notice }, queue, marked] = await Promise.all([props.searchParams, getMarkingQueue(user), getRecentlyMarked(user)]);

  return (
    <>
      <Notice value={notice} />
      <PageHeader title="Marking" description="Assignments waiting for you, oldest first. Quizzes mark themselves, so they don't appear here." />
      <div className="space-y-14">
        <Section title={`Waiting (${queue.length})`}>
          {queue.length === 0 ? (
            <EmptyState title="All marked">New submissions will appear here as students hand them in.</EmptyState>
          ) : (
            <ul className="divide-y divide-rule border-y border-rule">
              {queue.map((item) => {
                const overdue = item.assessment.dueAt && item.submittedAt > item.assessment.dueAt;
                return (
                  <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
                    <div className="min-w-0">
                      <p className="text-lg font-bold text-ink">{item.student.name}</p>
                      <p className="text-sm text-muted">
                        {item.assessment.title}, {item.assessment.course.title}. Handed in {formatRelative(item.submittedAt)}
                        {overdue ? `, after the ${formatDate(item.assessment.dueAt)} deadline` : ""}.
                      </p>
                    </div>
                    <LinkButton href={`/teach/marking/${item.id}`} size="sm">
                      Mark
                    </LinkButton>
                  </li>
                );
              })}
            </ul>
          )}
        </Section>

        {marked.length > 0 ? (
          <Section title="Recently marked">
            <ul className="divide-y divide-rule border-y border-rule">
              {marked.map((item) => (
                <li key={item.id} className="flex items-center gap-4 py-3">
                  <CircledScore score={item.score ?? 0} maxScore={item.maxScore} passPercent={item.assessment.passPercent} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="text-base font-bold text-ink">{item.student.name}</p>
                    <p className="text-sm text-muted">
                      {item.assessment.title}, {item.assessment.course.title}. Marked {item.gradedAt ? formatRelative(item.gradedAt) : ""}.
                    </p>
                  </div>
                  <LinkButton href={`/teach/marking/${item.id}`} variant="quiet" size="sm">
                    Review
                  </LinkButton>
                </li>
              ))}
            </ul>
          </Section>
        ) : null}
      </div>
    </>
  );
}
