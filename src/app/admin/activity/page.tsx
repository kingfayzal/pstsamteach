import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/ui/layout";
import { formatDateTime } from "@/lib/format";
import { requireRole } from "@/server/auth/session";
import { listAudit } from "@/server/queries/admin";

export const metadata: Metadata = { title: "Activity log" };

export default async function ActivityPage(props: PageProps<"/admin/activity">) {
  await requireRole("ADMIN");
  const { page } = await props.searchParams;
  const log = await listAudit(Number(Array.isArray(page) ? page[0] : page) || 1);

  return (
    <>
      <PageHeader title="Activity log" description="Every approval, publication, suspension and mark, newest first. Entries can't be edited." />
      <ul className="divide-y divide-rule border-y border-rule">
        {log.entries.map((entry) => (
          <li key={entry.id} className="grid grid-cols-1 gap-1 py-3 sm:grid-cols-[11rem_1fr_auto] sm:gap-4">
            <span className="figures text-sm text-muted">{formatDateTime(entry.createdAt)}</span>
            <span className="text-base text-ink">{entry.summary}</span>
            <span className="text-sm text-ink-soft">{entry.actor?.name ?? "System"}</span>
          </li>
        ))}
      </ul>
      {log.pages > 1 ? (
        <nav aria-label="Pages" className="mt-6 flex items-center gap-6 text-base">
          {log.page > 1 ? (
            <Link href={`/admin/activity?page=${log.page - 1}`} className="font-bold underline decoration-rule underline-offset-4">
              Newer entries
            </Link>
          ) : null}
          <span className="text-muted">
            Page {log.page} of {log.pages}
          </span>
          {log.page < log.pages ? (
            <Link href={`/admin/activity?page=${log.page + 1}`} className="font-bold underline decoration-rule underline-offset-4">
              Older entries
            </Link>
          ) : null}
        </nav>
      ) : null}
    </>
  );
}
