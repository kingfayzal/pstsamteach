import type { Metadata } from "next";
import Link from "next/link";
import { ConnectionStatus } from "@/components/teachers/connection-status";
import { LinkButton } from "@/components/ui/button";
import { EmptyState, PageHeader, Section } from "@/components/ui/layout";
import { Notice } from "@/components/ui/notice";
import { formatRelative } from "@/lib/format";
import { formatSlot } from "@/lib/time-zones";
import { requireRole } from "@/server/auth/session";
import { getViewerTimeZone } from "@/server/auth/viewer";
import { listTeacherConnections } from "@/server/queries/connections";

export const metadata: Metadata = { title: "Your students" };

type Row = Awaited<ReturnType<typeof listTeacherConnections>>["active"][number];

function StudentRow({ row, timeZone, cta }: { row: Row; timeZone: string; cta: string }) {
  return (
    <li className="flex flex-col gap-3 border-b border-rule py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-3">
          <Link href={`/teach/students/${row.id}`} className="text-lg font-extrabold text-ink hover:underline hover:decoration-rule hover:underline-offset-4">
            {row.student.name}
          </Link>
          <ConnectionStatus status={row.status} />
          {row.unread ? (
            <span className="figures rounded-full bg-ink px-2 py-0.5 text-xs font-bold text-paper">
              {row.unread} new message{row.unread === 1 ? "" : "s"}
            </span>
          ) : null}
        </div>
        <p className="text-sm text-muted">
          {row.topic ? `${row.topic.name}. ` : ""}
          {row.nextSession ? `Next session ${formatSlot(row.nextSession.startsAt, timeZone)}.` : row.status === "PENDING" ? `Asked ${formatRelative(row.createdAt)}.` : ""}
        </p>
        {row.status === "PENDING" ? <p className="line-clamp-2 max-w-[70ch] text-base text-ink-soft">{row.goals}</p> : null}
      </div>
      <LinkButton href={`/teach/students/${row.id}`} variant={row.status === "PENDING" ? "primary" : "secondary"} size="sm">
        {cta}
      </LinkButton>
    </li>
  );
}

export default async function TeacherStudentsPage(props: PageProps<"/teach/students">) {
  const user = await requireRole("TEACHER");
  const [{ notice }, groups, timeZone] = await Promise.all([props.searchParams, listTeacherConnections(user.id), getViewerTimeZone()]);

  return (
    <>
      <Notice value={notice} />
      <PageHeader
        title="Your students"
        description="Students who chose you for one-to-one sessions. Reply to requests quickly: students often ask more than one teacher."
        actions={<LinkButton href="/teach/profile" variant="secondary">Edit your profile</LinkButton>}
      />
      <div className="space-y-14">
        <Section title={`Requests (${groups.pending.length})`}>
          {groups.pending.length === 0 ? (
            <p className="text-base text-muted">No requests waiting. Students find you through the teacher directory.</p>
          ) : (
            <ul className="border-t border-rule">
              {groups.pending.map((row) => (
                <StudentRow key={row.id} row={row} timeZone={timeZone} cta="Review request" />
              ))}
            </ul>
          )}
        </Section>

        <Section title={`Current students (${groups.active.length})`}>
          {groups.active.length === 0 ? (
            <EmptyState title="No one-to-one students yet">
              When you accept a request, the student appears here with their sessions and messages.
            </EmptyState>
          ) : (
            <ul className="border-t border-rule">
              {groups.active.map((row) => (
                <StudentRow key={row.id} row={row} timeZone={timeZone} cta="Open" />
              ))}
            </ul>
          )}
        </Section>

        {groups.past.length ? (
          <Section title="Past">
            <ul className="border-t border-rule">
              {groups.past.map((row) => (
                <StudentRow key={row.id} row={row} timeZone={timeZone} cta="View" />
              ))}
            </ul>
          </Section>
        ) : null}
      </div>
    </>
  );
}
