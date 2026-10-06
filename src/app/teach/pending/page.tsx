import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/layout";
import { Notice } from "@/components/ui/notice";
import { formatDate } from "@/lib/format";
import { SITE, telHref } from "@/lib/site";
import { requireRole } from "@/server/auth/session";
import { getOwnApplication } from "@/server/queries/teacher";

export const metadata: Metadata = { title: "Your application" };

export default async function PendingPage(props: PageProps<"/teach/pending">) {
  const user = await requireRole("TEACHER", { allowPending: true });
  if (user.status !== "PENDING") redirect("/teach");
  const [application, { notice }] = await Promise.all([getOwnApplication(user.id), props.searchParams]);

  return (
    <>
      <Notice value={notice} />
      <PageHeader title="Your application is with our team" description="You'll be able to create courses as soon as an admin approves it. There's nothing else you need to do." />
      <div className="max-w-2xl space-y-8">
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-sm text-muted">Subject</dt>
            <dd className="text-lg font-bold text-ink">{application.applicationSubject?.name ?? "Not given"}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted">Sent</dt>
            <dd className="text-lg font-bold text-ink">{formatDate(application.createdAt)}</dd>
          </div>
        </dl>
        {application.applicationNote ? (
          <div>
            <p className="text-sm text-muted">What you told us</p>
            <p className="mt-1 border-l-2 border-rule pl-4 text-lg whitespace-pre-line text-ink-soft">{application.applicationNote}</p>
          </div>
        ) : null}
        <p className="text-base text-ink-soft">
          Questions? Email{" "}
          <a href={`mailto:${SITE.supportEmail}`} className="font-bold text-ink underline decoration-rule underline-offset-4">
            {SITE.supportEmail}
          </a>{" "}
          or text or call{" "}
          <a href={telHref(SITE.supportPhone)} className="font-bold whitespace-nowrap text-ink underline decoration-rule underline-offset-4">
            {SITE.supportPhone}
          </a>
          .
        </p>
      </div>
    </>
  );
}
