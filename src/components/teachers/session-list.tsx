import { CancelSessionForm } from "@/components/forms/cancel-session-form";
import { Pill } from "@/components/ui/badges";
import { attendanceNote, joinWindow, roomState } from "@/lib/live-sessions";
import { formatClock, formatInZone } from "@/lib/time-zones";
import { cancelSessionAction } from "@/server/actions/tutoring";

type Session = {
  id: string;
  startsAt: Date;
  endsAt: Date;
  status: "REQUESTED" | "CONFIRMED" | "CANCELLED";
  agenda: string | null;
  cancelReason: string | null;
  cancelledById: string | null;
  /** Stays in the video room, from LiveKit's webhooks. */
  attendance?: { userId: string; joinedAt: Date; leftAt: Date | null }[];
};

type Props = {
  sessions: Session[];
  viewerId: string;
  otherName: string;
  timeZone: string;
  meetingUrl: string | null;
  /** True when calls happen in Xcel Study; the meeting link is then only a backup inside the room. */
  liveRoom: boolean;
  returnTo: string;
  canCancel: boolean;
  now?: Date;
};

const JOIN_BUTTON = "rounded-control bg-ink px-3 py-2 text-sm font-bold text-paper hover:bg-ink-deep";

function when(session: Session, timeZone: string) {
  const day = formatInZone(session.startsAt, timeZone, { weekday: "long", day: "numeric", month: "long" });
  return `${day}, ${formatClock(session.startsAt, timeZone)}–${formatClock(session.endsAt, timeZone)}`;
}

function JoinControl({ session, meetingUrl, liveRoom, label }: { session: Session; meetingUrl: string | null; liveRoom: boolean; label: string }) {
  if (session.status !== "CONFIRMED") return null;
  if (liveRoom) {
    // A full page load, not <Link>: only the room's own document may use the camera (see security-headers.ts).
    return (
      <a href={`/sessions/${session.id}`} className={JOIN_BUTTON} aria-label={label}>
        Join the session
      </a>
    );
  }
  if (meetingUrl) {
    return (
      <a href={meetingUrl} target="_blank" rel="noopener noreferrer" className={JOIN_BUTTON} aria-label={label}>
        Join the session
      </a>
    );
  }
  return <span className="text-sm text-muted">The meeting link will appear here.</span>;
}

/** Upcoming sessions with join links, then past and cancelled ones. */
export function SessionList({ sessions, viewerId, otherName, timeZone, meetingUrl, liveRoom, returnTo, canCancel, now = new Date() }: Props) {
  // After the booked end the video room stays open a little while, so people can get back in.
  const stillOpen = (s: Session) => liveRoom && s.endsAt <= now && roomState(s, now) === "open";
  const upcoming = sessions.filter((s) => s.status !== "CANCELLED" && (s.endsAt > now || stillOpen(s)) && !(s.status === "REQUESTED" && s.startsAt <= now));
  const past = sessions.filter((s) => s.status === "CONFIRMED" && s.endsAt <= now && !stillOpen(s)).reverse();
  const cancelled = sessions.filter((s) => s.status === "CANCELLED").reverse();

  return (
    <div className="space-y-8">
      {upcoming.length === 0 ? (
        <p className="text-base text-muted">No upcoming sessions.</p>
      ) : (
        <ul className="divide-y divide-rule border-y border-rule">
          {upcoming.map((s) => {
            const live = s.startsAt <= now;
            return (
              <li key={s.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 space-y-1">
                  <p className="figures text-lg font-bold text-ink">{when(s, timeZone)}</p>
                  {s.agenda ? <p className="text-base text-ink-soft">To cover: {s.agenda}</p> : null}
                  {s.status === "REQUESTED" ? (
                    <Pill tone="warn">Waiting for confirmation</Pill>
                  ) : (
                    <Pill tone="good">{stillOpen(s) ? "Room still open" : live ? "Happening now" : "Confirmed"}</Pill>
                  )}
                </div>
                <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
                  <JoinControl session={s} meetingUrl={meetingUrl} liveRoom={liveRoom} label={`Join the session on ${when(s, timeZone)}`} />
                  {canCancel && !live ? <CancelSessionForm action={cancelSessionAction.bind(null, s.id, returnTo)} /> : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {past.length ? (
        <details>
          <summary className="cursor-pointer text-base font-bold text-ink">Past sessions ({past.length})</summary>
          <ul className="mt-3 divide-y divide-rule border-y border-rule">
            {past.map((s) => {
              // Someone still connected counts up to now, never beyond the room's closing time.
              const until = new Date(Math.min(now.getTime(), joinWindow(s).closesAt.getTime()));
              const note = attendanceNote(s.attendance ?? [], viewerId, otherName, until);
              return (
                <li key={s.id} className="py-2.5 text-base text-ink-soft">
                  <span className="figures">
                    {when(s, timeZone)}
                    {s.agenda ? `: ${s.agenda}` : ""}
                  </span>
                  {note ? <span className="figures block text-sm text-muted">{note}</span> : null}
                </li>
              );
            })}
          </ul>
        </details>
      ) : null}

      {cancelled.length ? (
        <details>
          <summary className="cursor-pointer text-base font-bold text-ink">Cancelled ({cancelled.length})</summary>
          <ul className="mt-3 divide-y divide-rule border-y border-rule">
            {cancelled.map((s) => (
              <li key={s.id} className="py-2.5 text-base text-ink-soft">
                <span className="figures">{when(s, timeZone)}</span>
                <span className="block text-sm text-muted">
                  Cancelled by {s.cancelledById === viewerId ? "you" : otherName}
                  {s.cancelReason ? `: ${s.cancelReason}` : "."}
                </span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
