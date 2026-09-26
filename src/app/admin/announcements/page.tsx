import type { Metadata } from "next";
import { AnnouncementForm } from "@/components/forms/simple-forms";
import { ActionButton } from "@/components/ui/action-button";
import { Pill } from "@/components/ui/badges";
import { PageHeader, Section } from "@/components/ui/layout";
import { formatRelative } from "@/lib/format";
import { deletePlatformAnnouncementAction, postPlatformAnnouncementAction } from "@/server/actions/admin";
import { requireRole } from "@/server/auth/session";
import { listPlatformAnnouncements } from "@/server/queries/admin";

export const metadata: Metadata = { title: "Announcements" };

const AUDIENCE_LABEL = { EVERYONE: "Everyone", STUDENTS: "Students", TEACHERS: "Teachers" } as const;

export default async function AdminAnnouncementsPage() {
  await requireRole("ADMIN");
  const announcements = await listPlatformAnnouncements();

  return (
    <>
      <PageHeader title="Announcements" description="Platform-wide messages. They appear on student and teacher dashboards." />
      <div className="space-y-14">
        <Section title="Post an announcement">
          <AnnouncementForm action={postPlatformAnnouncementAction} withAudience />
        </Section>
        <Section title="Posted">
          {announcements.length === 0 ? (
            <p className="text-base text-muted">Nothing posted yet.</p>
          ) : (
            <ul className="divide-y divide-rule border-y border-rule">
              {announcements.map((a) => (
                <li key={a.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 text-sm text-muted">
                      <Pill>{AUDIENCE_LABEL[a.audience]}</Pill>
                      {a.author.name}, {formatRelative(a.createdAt)}
                    </p>
                    <p className="mt-1 text-lg font-bold text-ink">{a.title}</p>
                    <p className="max-w-[65ch] text-base whitespace-pre-line text-ink-soft">{a.body}</p>
                  </div>
                  <ActionButton action={deletePlatformAnnouncementAction.bind(null, a.id)} label="Delete" pendingLabel="Deleting…" variant="danger" confirm="Delete this announcement?" />
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </>
  );
}
