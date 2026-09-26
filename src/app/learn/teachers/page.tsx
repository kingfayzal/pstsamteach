import type { Metadata } from "next";
import Link from "next/link";
import { ConnectionStatus } from "@/components/teachers/connection-status";
import { TeacherAvatar } from "@/components/teachers/teacher-avatar";
import { LinkButton } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/ui/layout";
import { Notice } from "@/components/ui/notice";
import { formatSlot } from "@/lib/time-zones";
import { requireRole } from "@/server/auth/session";
import { getViewerTimeZone } from "@/server/auth/viewer";
import { listStudentConnections } from "@/server/queries/connections";

export const metadata: Metadata = { title: "My teachers" };

export default async function MyTeachersPage(props: PageProps<"/learn/teachers">) {
  const user = await requireRole("STUDENT");
  const [{ notice }, connections, timeZone] = await Promise.all([props.searchParams, listStudentConnections(user.id), getViewerTimeZone()]);

  return (
    <>
      <Notice value={notice} />
      <PageHeader
        title="My teachers"
        description="The teachers you work with one to one, and the requests you've sent."
        actions={<LinkButton href="/teachers" variant="secondary">Find a teacher</LinkButton>}
      />
      {connections.length === 0 ? (
        <EmptyState title="You haven't chosen a teacher yet" action={<LinkButton href="/teachers">Browse teachers</LinkButton>}>
          Read teachers&rsquo; profiles, watch their introductions and pick the one you connect with. You can book live sessions once they accept.
        </EmptyState>
      ) : (
        <ul className="border-t border-rule">
          {connections.map((c) => (
            <li key={c.id} className="flex flex-col gap-4 border-b border-rule py-5 sm:flex-row sm:items-center">
              <TeacherAvatar name={c.teacher.name} photo={c.photo} color={c.color} size="md" />
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-3">
                  <Link href={`/learn/teachers/${c.id}`} className="text-xl font-extrabold text-ink hover:underline hover:decoration-rule hover:underline-offset-4">
                    {c.teacher.name}
                  </Link>
                  <ConnectionStatus status={c.status} />
                  {c.unread ? (
                    <span className="figures rounded-full bg-ink px-2 py-0.5 text-xs font-bold text-paper">
                      {c.unread} new message{c.unread === 1 ? "" : "s"}
                    </span>
                  ) : null}
                </div>
                {c.teacher.teacherProfile ? <p className="text-base text-ink-soft">{c.teacher.teacherProfile.headline}</p> : null}
                <p className="text-sm text-muted">
                  {c.nextSession ? `Next session: ${formatSlot(c.nextSession.startsAt, timeZone)}` : c.status === "ACTIVE" ? "No session booked." : ""}
                  {c.topic ? ` ${c.topic.name}.` : ""}
                </p>
              </div>
              <LinkButton href={`/learn/teachers/${c.id}`} variant="secondary" size="sm">
                Open
              </LinkButton>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
