import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AnnouncementForm } from "@/components/forms/simple-forms";
import { ActionButton } from "@/components/ui/action-button";
import { Section } from "@/components/ui/layout";
import { formatRelative } from "@/lib/format";
import { deleteAnnouncementAction, postAnnouncementAction } from "@/server/actions/teaching";
import { requireRole } from "@/server/auth/session";
import { getCourseAnnouncements } from "@/server/queries/teacher";

export const metadata: Metadata = { title: "Announcements" };

export default async function CourseAnnouncementsPage(props: PageProps<"/teach/courses/[courseId]/announcements">) {
  const user = await requireRole("TEACHER");
  const { courseId } = await props.params;
  const data = await getCourseAnnouncements(user, courseId);
  if (!data) notFound();

  return (
    <div className="space-y-14">
      <Section title="Post to enrolled students" description="It appears on their dashboard and on the course page.">
        <AnnouncementForm action={postAnnouncementAction.bind(null, courseId)} />
      </Section>
      <Section title="Posted">
        {data.announcements.length === 0 ? (
          <p className="text-base text-muted">Nothing posted yet.</p>
        ) : (
          <ul className="divide-y divide-rule border-y border-rule">
            {data.announcements.map((a) => (
              <li key={a.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm text-muted">{formatRelative(a.createdAt)}</p>
                  <p className="text-lg font-bold text-ink">{a.title}</p>
                  <p className="max-w-[65ch] text-base whitespace-pre-line text-ink-soft">{a.body}</p>
                </div>
                <ActionButton action={deleteAnnouncementAction.bind(null, courseId, a.id)} label="Delete" pendingLabel="Deleting…" variant="danger" confirm="Delete this announcement?" />
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
