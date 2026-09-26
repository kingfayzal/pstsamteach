import { CancelSessionForm } from "@/components/forms/cancel-session-form";
import { Pill } from "@/components/ui/badges";
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
};

type Props = {
  sessions: Session[];
  viewerId: string;
  otherName: string;
  timeZone: string;
  meetingUrl: string | null;
  returnTo: string;
  canCancel: boolean;
  now?: Date;
};

function when(session: Session, timeZone: string) {
  const day = formatInZone(session.startsAt, timeZone, { weekday: "long", day: "numeric", month: "long" });
  return `${day}, ${formatClock(session.startsAt, timeZone)}–${formatClock(session.endsAt, timeZone)}`;
}

/** Upcoming sessions with join links, then past and cancelled ones. */
export function SessionList({ sessions, viewerId, otherName, timeZone, meetingUrl, returnTo, canCancel, now = new Date() }: Props) {
  const upcoming = sessions.filter((s) => s.status !== "CANCELLED" && s.endsAt > now && !(s.status === "REQUESTED" && s.startsAt <= now));
  const past = sessions.filter((s) => s.status === "CONFIRMED" && s.endsAt <= now).reverse();
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
                  {s.status === "REQUESTED" ? <Pill tone="warn">Waiting for confirmation</Pill> : <Pill tone="good">{live ? "Happening now" : "Confirmed"}</Pill>}
                </div>
                <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
                  {s.status === "CONFIRMED" && meetingUrl ? (
                    <a
                      href={meetingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-control bg-ink px-3 py-2 text-sm font-bold text-paper hover:bg-ink-deep"
                    >
                      Join the session
                    </a>
                  ) : null}
                  {s.status === "CONFIRMED" && !meetingUrl ? <span className="text-sm text-muted">The meeting link will appear here.</span> : null}
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
            {past.map((s) => (
              <li key={s.id} className="figures py-2.5 text-base text-ink-soft">
                {when(s, timeZone)}
                {s.agenda ? `: ${s.agenda}` : ""}
              </li>
            ))}
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
