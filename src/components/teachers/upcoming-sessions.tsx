import Link from "next/link";
import { Pill } from "@/components/ui/badges";
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

/** A compact list of the next few live sessions, for dashboards. */
export function UpcomingSessions({ sessions, timeZone, linkBase, now = new Date() }: { sessions: Session[]; timeZone: string; linkBase: string; now?: Date }) {
  return (
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
            ) : s.meetingUrl ? (
              <a href={s.meetingUrl} target="_blank" rel="noopener noreferrer" className="rounded-control bg-ink px-3 py-1.5 text-sm font-bold text-paper hover:bg-ink-deep">
                {live ? "Join now" : "Join link"}
              </a>
            ) : (
              <Pill tone="good">Confirmed</Pill>
            )}
          </li>
        );
      })}
    </ul>
  );
}
