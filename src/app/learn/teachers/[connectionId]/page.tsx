import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ConnectionStatus } from "@/components/teachers/connection-status";
import { MessageThread } from "@/components/teachers/message-thread";
import { SessionList } from "@/components/teachers/session-list";
import { TeacherAvatar } from "@/components/teachers/teacher-avatar";
import { ActionButton } from "@/components/ui/action-button";
import { LinkButton } from "@/components/ui/button";
import { Breadcrumbs, Section } from "@/components/ui/layout";
import { Notice } from "@/components/ui/notice";
import { formatDate } from "@/lib/format";
import { endConnectionAction } from "@/server/actions/tutoring";
import { requireRole } from "@/server/auth/session";
import { getViewerTimeZone } from "@/server/auth/viewer";
import { getStudentConnection } from "@/server/queries/connections";
import { photoUrl } from "@/server/queries/teachers";

export const metadata: Metadata = { title: "Your teacher" };

export default async function StudentConnectionPage(props: PageProps<"/learn/teachers/[connectionId]">) {
  const user = await requireRole("STUDENT");
  const [{ connectionId }, { notice }, timeZone] = await Promise.all([props.params, props.searchParams, getViewerTimeZone()]);
  const connection = await getStudentConnection(user.id, connectionId);
  if (!connection) notFound();
  const teacher = connection.teacher;
  const profile = teacher.teacherProfile;
  const firstName = teacher.name.split(" ")[0];
  const open = connection.status === "PENDING" || connection.status === "ACTIVE";
  const here = `/learn/teachers/${connection.id}`;

  return (
    <>
      <Notice value={notice} />
      <Breadcrumbs items={[{ href: "/learn/teachers", label: "My teachers" }]} />
      <header className="mb-8 flex flex-col gap-5 border-b border-rule pb-6 sm:flex-row sm:items-center">
        <TeacherAvatar name={teacher.name} photo={profile ? photoUrl(profile) : null} color={profile?.topics[0]?.topic.subject.color} size="lg" />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl text-ink">{teacher.name}</h1>
            <ConnectionStatus status={connection.status} />
          </div>
          {profile ? <p className="text-lg text-ink-soft">{profile.headline}</p> : null}
          {profile ? (
            <Link href={`/teachers/${profile.slug}`} className="text-sm font-bold text-ink-soft underline decoration-rule underline-offset-4">
              View {firstName}&rsquo;s profile and reviews
            </Link>
          ) : null}
        </div>
        {connection.status === "ACTIVE" ? <LinkButton href={`${here}/book`}>Book a session</LinkButton> : null}
      </header>

      {connection.status === "PENDING" ? (
        <p className="mb-8 border border-amber/30 bg-amber-wash px-4 py-3 text-base text-amber">
          <span className="font-bold">Waiting for {firstName} to reply.</span> You sent your request on {formatDate(connection.createdAt)}. You can message them in the meantime.
        </p>
      ) : null}
      {connection.status === "DECLINED" ? (
        <div className="mb-8 border border-rule bg-sheet px-4 py-3">
          <p className="text-base font-bold text-ink">{firstName} couldn&rsquo;t take you on this time.</p>
          {connection.responseNote ? <p className="mt-1 text-base whitespace-pre-line text-ink-soft">&ldquo;{connection.responseNote}&rdquo;</p> : null}
          <Link href="/teachers" className="mt-2 inline-block text-base font-bold text-ink underline decoration-rule underline-offset-4">
            Find another teacher
          </Link>
        </div>
      ) : null}
      {connection.status === "ENDED" ? (
        <p className="mb-8 border border-rule bg-sheet px-4 py-3 text-base text-ink-soft">
          You stopped working together on {formatDate(connection.endedAt)}.{" "}
          {profile ? (
            <Link href={`/teachers/${profile.slug}/choose`} className="font-bold text-ink underline decoration-rule underline-offset-4">
              Ask {firstName} again
            </Link>
          ) : null}
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-12">
          <Section title="Sessions" description={`Times are in your time zone (${timeZone.replace(/_/g, " ")}).`}>
            <SessionList
              sessions={connection.sessions}
              viewerId={user.id}
              otherName={firstName}
              timeZone={timeZone}
              meetingUrl={profile?.meetingUrl ?? null}
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
          <div className="space-y-2 border border-rule bg-sheet p-5">
            <h2 className="text-lg text-ink">What you asked for</h2>
            {connection.topic ? <p className="text-sm font-bold text-ink-soft">{connection.topic.name}</p> : null}
            <p className="text-base whitespace-pre-line text-ink-soft">{connection.goals}</p>
          </div>
          {open ? (
            <ActionButton
              action={endConnectionAction.bind(null, connection.id)}
              label={connection.status === "PENDING" ? "Withdraw request" : `Stop working with ${firstName}`}
              pendingLabel="Updating…"
              variant="danger"
              confirm={connection.status === "PENDING" ? "Withdraw your request?" : `Stop working with ${firstName}? Future sessions will be cancelled.`}
            />
          ) : null}
        </aside>
      </div>
    </>
  );
}
