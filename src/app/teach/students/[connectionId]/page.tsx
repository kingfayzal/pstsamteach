import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RespondForm } from "@/components/forms/respond-form";
import { ConnectionStatus } from "@/components/teachers/connection-status";
import { MessageThread } from "@/components/teachers/message-thread";
import { SessionList } from "@/components/teachers/session-list";
import { ActionButton } from "@/components/ui/action-button";
import { Breadcrumbs, Section } from "@/components/ui/layout";
import { InkProgress } from "@/components/ui/marks";
import { Notice } from "@/components/ui/notice";
import { formatDate } from "@/lib/format";
import { endConnectionAction, respondToRequestAction } from "@/server/actions/tutoring";
import { requireRole } from "@/server/auth/session";
import { getViewerTimeZone } from "@/server/auth/viewer";
import { getTeacherConnection } from "@/server/queries/connections";
import { getProfileEditor } from "@/server/queries/teachers";
import { isLiveVideoEnabled } from "@/server/video";

export const metadata: Metadata = { title: "Student" };

export default async function TeacherConnectionPage(props: PageProps<"/teach/students/[connectionId]">) {
  const user = await requireRole("TEACHER");
  const [{ connectionId }, { notice }, timeZone] = await Promise.all([props.params, props.searchParams, getViewerTimeZone()]);
  const [data, editor] = await Promise.all([getTeacherConnection(user.id, connectionId), getProfileEditor(user.id)]);
  if (!data) notFound();
  const { connection, courses } = data;
  const firstName = connection.student.name.split(" ")[0];
  const open = connection.status === "PENDING" || connection.status === "ACTIVE";
  const here = `/teach/students/${connection.id}`;

  return (
    <>
      <Notice value={notice} />
      <Breadcrumbs items={[{ href: "/teach/students", label: "Your students" }]} />
      <header className="mb-8 space-y-2 border-b border-rule pb-6">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl text-ink">{connection.student.name}</h1>
          <ConnectionStatus status={connection.status} />
        </div>
        <p className="text-base text-muted">
          {connection.student.email}. {connection.status === "PENDING" ? `Asked on ${formatDate(connection.createdAt)}.` : ""}
          {connection.status === "ACTIVE" && connection.respondedAt ? `Your student since ${formatDate(connection.respondedAt)}.` : ""}
        </p>
      </header>

      <div className="grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-12">
          <Section title={connection.status === "PENDING" ? `${firstName}'s request` : "Their goals"}>
            {connection.topic ? <p className="text-sm font-bold text-ink-soft">{connection.topic.name}</p> : null}
            <p className="max-w-[68ch] border-l-2 border-margin pl-4 text-lg whitespace-pre-line text-ink-soft">{connection.goals}</p>
            {connection.status === "PENDING" ? (
              <RespondForm
                accept={respondToRequestAction.bind(null, connection.id, true)}
                decline={respondToRequestAction.bind(null, connection.id, false)}
                studentFirstName={firstName}
              />
            ) : null}
          </Section>

          <Section title="Sessions" description={`Times are in your time zone (${timeZone.replace(/_/g, " ")}).`}>
            <SessionList
              sessions={connection.sessions}
              viewerId={user.id}
              otherName={firstName}
              timeZone={timeZone}
              meetingUrl={editor?.profile.meetingUrl ?? null}
              liveRoom={isLiveVideoEnabled()}
              returnTo={here}
              canCancel={open}
            />
          </Section>

          <Section title="Messages">
            <MessageThread
              connectionId={connection.id}
              messages={connection.messages}
              viewerId={user.id}
              otherName={firstName}
              timeZone={timeZone}
              open={open}
              returnTo={here}
            />
          </Section>
        </div>

        <aside className="space-y-6">
          <div className="space-y-4 border border-rule bg-sheet p-5">
            <h2 className="text-lg text-ink">In your courses</h2>
            {courses.length === 0 ? (
              <p className="text-base text-muted">{firstName} isn&rsquo;t enrolled in any of your courses.</p>
            ) : (
              <ul className="space-y-4">
                {courses.map((course) => (
                  <li key={course.id} className="space-y-1">
                    <p className="text-base font-bold text-ink">{course.title}</p>
                    <InkProgress percent={course.summary.progress.percent} label={`${course.title} progress`} />
                  </li>
                ))}
              </ul>
            )}
          </div>
          {connection.status === "ACTIVE" ? (
            <ActionButton
              action={endConnectionAction.bind(null, connection.id)}
              label={`Stop teaching ${firstName}`}
              pendingLabel="Updating…"
              variant="danger"
              confirm={`Stop teaching ${firstName}? Future sessions will be cancelled.`}
            />
          ) : null}
        </aside>
      </div>
    </>
  );
}
