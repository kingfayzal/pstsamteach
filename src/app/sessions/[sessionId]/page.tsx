import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { BackupLink } from "@/components/live/backup-link";
import { LiveRoom } from "@/components/live/live-room";
import { RefreshAt } from "@/components/live/refresh-at";
import { buttonClasses } from "@/components/ui/button";
import { JOIN_OPENS_MINUTES_BEFORE, joinWindow, roomState } from "@/lib/live-sessions";
import { formatClock, formatInZone } from "@/lib/time-zones";
import { requireUser } from "@/server/auth/session";
import { getViewerTimeZone } from "@/server/auth/viewer";
import { getLiveSession, type LiveSession } from "@/server/queries/live-sessions";
import { isLiveVideoEnabled } from "@/server/video";

export const metadata: Metadata = { title: "Live session" };

function RoomNotice({ session, title, children }: { session: LiveSession; title: string; children?: ReactNode }) {
  const teacherName = session.role === "student" ? session.otherName : "";
  return (
    <div className="mx-auto w-full max-w-2xl space-y-5 px-4 py-10 sm:px-6">
      <h1 className="text-3xl text-ink">{title}</h1>
      {children}
      {/* A full page load: leaving the room restores the stricter camera rules of other pages. */}
      <a href={session.backHref} className={buttonClasses("secondary")}>
        Back to {session.otherName.split(" ")[0]}
      </a>
      <BackupLink url={session.backupUrl} role={session.role} teacherName={teacherName} />
    </div>
  );
}

export default async function SessionRoomPage(props: PageProps<"/sessions/[sessionId]">) {
  const user = await requireUser();
  const [{ sessionId }, timeZone] = await Promise.all([props.params, getViewerTimeZone()]);
  const now = new Date();
  const session = await getLiveSession(user.id, sessionId, now);
  if (!session) notFound();

  const state = roomState(session, now);
  const day = formatInZone(session.startsAt, timeZone, { weekday: "long", day: "numeric", month: "long" });
  const time = `${formatClock(session.startsAt, timeZone)}–${formatClock(session.endsAt, timeZone)}`;

  if (state === "cancelled") return <RoomNotice session={session} title="This session was cancelled." />;
  if (state === "unconfirmed") return <RoomNotice session={session} title="This session hasn't been confirmed yet." />;
  if (state === "ended") {
    return (
      <RoomNotice session={session} title="This session has finished.">
        <p className="figures text-lg text-ink-soft">
          {day}, {time}
        </p>
      </RoomNotice>
    );
  }
  if (!session.partnershipActive) return <RoomNotice session={session} title="This room is closed because you're no longer working together." />;
  if (!isLiveVideoEnabled()) {
    return (
      <RoomNotice session={session} title="Video calls in Xcel Study aren't switched on yet.">
        <p className="text-base text-ink-soft">Use the meeting link below for this session.</p>
      </RoomNotice>
    );
  }
  if (state === "upcoming") {
    const { opensAt } = joinWindow(session);
    return (
      <RoomNotice session={session} title={`Your session with ${session.otherName} starts at ${formatClock(session.startsAt, timeZone)}.`}>
        <p className="figures text-lg text-ink-soft">
          {day}, {time}
        </p>
        <p className="text-base text-ink-soft">
          The room opens at <span className="figures">{formatClock(opensAt, timeZone)}</span>, {JOIN_OPENS_MINUTES_BEFORE} minutes before the start, so you
          can check your camera and microphone. This page opens it for you.
        </p>
        <RefreshAt inMs={opensAt.getTime() - now.getTime()} />
      </RoomNotice>
    );
  }

  return (
    <LiveRoom
      sessionId={session.id}
      viewerId={user.id}
      role={session.role}
      otherName={session.otherName}
      teacherName={session.role === "student" ? session.otherName : user.name}
      startsAt={session.startsAt}
      endsAt={session.endsAt}
      agenda={session.agenda}
      timeZone={timeZone}
      backupUrl={session.backupUrl}
      backHref={session.backHref}
    />
  );
}
