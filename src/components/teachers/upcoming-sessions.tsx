import Link from "next/link";
import { RefreshAt } from "@/components/live/refresh-at";
import { Pill } from "@/components/ui/badges";
import { joinWindow, roomState } from "@/lib/live-sessions";
import { formatClock, formatInZone } from "@/lib/time-zones";

type Session = {
  id: string;
  startsAt: Date;
  endsAt: Date;
  status: "REQUESTED" | "CONFIRMED" | "CANCELLED";
  otherName: string;
  meetingUrl: string | null;
  connection: { id: string };
};

type Props = {
  sessions: Session[];
  timeZone: string;
  linkBase: string;
  /** True when calls happen in Xcel Study rather than on the teacher's meeting link. */
  liveRoom: boolean;
  now?: Date;
};

const JOIN_BUTTON = "rounded-control bg-ink px-3 py-1.5 text-sm font-bold text-paper hover:bg-ink-deep";

/** A compact list of the next few live sessions, for dashboards. */
export function UpcomingSessions({ sessions, timeZone, linkBase, liveRoom, now = new Date() }: Props) {
  // Turn "Confirmed" into "Join now" when the next room opens, without a reload.
  const nextOpening = liveRoom
    ? sessions
        .filter((s) => roomState(s, now) === "upcoming")
        .map((s) => joinWindow(s).opensAt.getTime() - now.getTime())
        .sort((a, b) => a - b)[0]
    : undefined;
  return (
    <>
      {nextOpening !== undefined ? <RefreshAt inMs={nextOpening} /> : null}
      <ul className="divide-y divide-rule border-y border-rule">
        {sessions.map((s) => {
          const live = s.startsAt <= now;
          return (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="figures text-base font-bold text-ink">
                  {formatInZone(s.startsAt, timeZone, { weekday: "short", day: "numeric", month: "short" })}, {formatClock(s.startsAt, timeZone)}–{formatClock(s.endsAt, timeZone)}
                </p>
                <Link href={`${linkBase}/${s.connection.id}`} className="text-sm text-ink-soft underline decoration-rule underline-offset-4 hover:text-ink">
                  with {s.otherName}
                </Link>
              </div>
              {s.status === "REQUESTED" ? (
                <Pill tone="warn">Waiting for confirmation</Pill>
              ) : liveRoom ? (
                roomState(s, now) === "open" ? (
                  // A full page load, not <Link>: only the room's own document may use the camera (see security-headers.ts).
                  <a href={`/sessions/${s.id}`} className={JOIN_BUTTON} aria-label={`Join now, ${formatClock(s.startsAt, timeZone)} session with ${s.otherName}`}>
                    Join now
                  </a>
                ) : (
                  <Pill tone="good">Confirmed</Pill>
                )
              ) : s.meetingUrl ? (
                <a href={s.meetingUrl} target="_blank" rel="noopener noreferrer" className={JOIN_BUTTON}>
                  {live ? "Join now" : "Join link"}
                </a>
              ) : (
                <Pill tone="good">Confirmed</Pill>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}
