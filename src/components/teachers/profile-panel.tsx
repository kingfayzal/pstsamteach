import Link from "next/link";
import type { Role } from "@/generated/prisma/enums";
import { ActionButton } from "@/components/ui/action-button";
import { LinkButton } from "@/components/ui/button";
import { formatSlot } from "@/lib/time-zones";
import { toggleSavedTeacherAction } from "@/server/actions/find-teacher";

type Relation = { connection: { id: string; status: "PENDING" | "ACTIVE" | "DECLINED" | "ENDED" } | null; saved: boolean };

type Props = {
  teacherId: string;
  slug: string;
  firstName: string;
  acceptingStudents: boolean;
  sessionMinutes: number;
  nextSlot: Date | null;
  timeZone: string;
  viewer: { id?: string; role?: Role };
  isOwner: boolean;
  relation: Relation;
};

/** The call to action beside a profile, depending on who's looking. */
export function ProfilePanel({ teacherId, slug, firstName, acceptingStudents, sessionMinutes, nextSlot, timeZone, viewer, isOwner, relation }: Props) {
  const status = relation.connection?.status;
  const canChoose = acceptingStudents && (viewer.role === "STUDENT" || !viewer.id) && status !== "PENDING" && status !== "ACTIVE";

  return (
    <div className="space-y-5 border border-rule bg-sheet p-6">
      <dl className="space-y-3">
        <div>
          <dt className="text-sm text-muted">Next free time</dt>
          <dd className="text-lg font-bold text-ink">{acceptingStudents ? (nextSlot ? formatSlot(nextSlot, timeZone) : "Fully booked for two weeks") : "Not taking new students"}</dd>
        </div>
        <div>
          <dt className="text-sm text-muted">Sessions</dt>
          <dd className="text-lg font-bold text-ink">{sessionMinutes} minutes, live online</dd>
        </div>
      </dl>

      {isOwner ? (
        <div className="space-y-3">
          <p className="text-base text-ink-soft">This is how students see your profile.</p>
          <LinkButton href="/teach/profile" className="w-full">
            Edit your profile
          </LinkButton>
        </div>
      ) : null}

      {status === "ACTIVE" && relation.connection ? (
        <div className="space-y-3">
          <p className="text-base font-bold text-tick-text">{firstName} is your teacher.</p>
          <LinkButton href={`/learn/teachers/${relation.connection.id}/book`} className="w-full">
            Book a session
          </LinkButton>
          <LinkButton href={`/learn/teachers/${relation.connection.id}`} variant="secondary" className="w-full">
            Messages and sessions
          </LinkButton>
        </div>
      ) : null}

      {status === "PENDING" && relation.connection ? (
        <div className="space-y-3">
          <p className="text-base text-ink-soft">You&rsquo;ve asked {firstName} to be your teacher. They&rsquo;ll reply soon.</p>
          <LinkButton href={`/learn/teachers/${relation.connection.id}`} variant="secondary" className="w-full">
            See your request
          </LinkButton>
        </div>
      ) : null}

      {canChoose ? (
        <LinkButton href={`/teachers/${slug}/choose`} className="w-full">
          Choose {firstName} as your teacher
        </LinkButton>
      ) : null}

      {!acceptingStudents && !isOwner && status !== "ACTIVE" ? (
        <p className="text-base text-ink-soft">{firstName} isn&rsquo;t taking new students right now. Save them to your shortlist and check back.</p>
      ) : null}

      {viewer.role === "STUDENT" ? (
        <ActionButton
          action={toggleSavedTeacherAction.bind(null, teacherId)}
          label={relation.saved ? "Saved to your shortlist" : "Save to your shortlist"}
          pendingLabel="Saving…"
          variant="secondary"
          className="w-full [&_button]:w-full"
        />
      ) : null}

      {!viewer.id ? (
        <p className="text-sm text-muted">
          You&rsquo;ll need a free student account to choose a teacher.{" "}
          <Link href={`/login?next=/teachers/${slug}`} className="font-bold text-ink underline decoration-rule underline-offset-4">
            Log in
          </Link>
        </p>
      ) : null}
    </div>
  );
}
