import Link from "next/link";
import type { CSSProperties } from "react";
import { ActionButton } from "@/components/ui/action-button";
import { LinkButton } from "@/components/ui/button";
import { plural } from "@/lib/format";
import { formatSlot } from "@/lib/time-zones";
import { toggleSavedTeacherAction } from "@/server/actions/find-teacher";
import type { DirectoryRow } from "@/server/queries/teachers";
import { RatingSummary } from "./rating";
import { TeacherAvatar } from "./teacher-avatar";
import { TopicTags } from "./topic-tags";

type Props = { teacher: DirectoryRow; viewerTimeZone: string; canSave: boolean };

/** One teacher in the directory: who they are, what they teach, and when they're free. */
export function TeacherRow({ teacher, viewerTimeZone, canSave }: Props) {
  const color = teacher.subjects[0]?.color;
  const href = `/teachers/${teacher.slug}`;
  return (
    <li className="grid grid-cols-1 gap-5 border-b border-rule py-7 sm:grid-cols-[7rem_minmax(0,1fr)] lg:grid-cols-[7rem_minmax(0,1fr)_14rem]" style={{ "--subject": color } as CSSProperties}>
      <Link href={href} className="block self-start rounded-book" tabIndex={-1} aria-hidden="true">
        <TeacherAvatar name={teacher.name} photo={teacher.photo} color={color} size="lg" />
      </Link>

      <div className="min-w-0 space-y-2.5">
        <div>
          <h2 className="text-xl text-ink">
            <Link href={href} className="hover:underline hover:decoration-rule hover:underline-offset-4">
              {teacher.name}
            </Link>
          </h2>
          <p className="text-lg font-bold text-ink-soft">{teacher.headline}</p>
        </div>
        <TopicTags subjects={teacher.subjects} compact />
        <p className="text-sm text-muted">
          Teaches in {teacher.languages.join(", ")}
          {teacher.experienceYears ? `. ${plural(teacher.experienceYears, "year")} of experience` : ""}.
        </p>
        <p className="max-w-[68ch] text-base text-ink-soft">{teacher.about}</p>
        <p className="text-sm font-bold text-ink">
          {!teacher.acceptingStudents
            ? "Not taking new students right now"
            : teacher.nextSlot
              ? `Next free: ${formatSlot(teacher.nextSlot, viewerTimeZone)}`
              : "Fully booked for the next two weeks"}
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:col-start-2 lg:col-start-auto lg:items-end lg:text-right">
        <RatingSummary average={teacher.average} count={teacher.reviewCount} />
        <p className="figures text-sm text-muted">
          {plural(teacher.students, "student")}, {plural(teacher.sessionsTaught, "session")} taught
        </p>
        <div className="flex flex-wrap gap-3 lg:justify-end">
          <LinkButton href={href} size="sm">
            View profile
          </LinkButton>
          {canSave ? (
            <ActionButton
              action={toggleSavedTeacherAction.bind(null, teacher.teacherId)}
              label={teacher.saved ? "Saved" : "Save"}
              pendingLabel="Saving…"
              variant="secondary"
            />
          ) : null}
        </div>
      </div>
    </li>
  );
}
