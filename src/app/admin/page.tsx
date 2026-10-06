import type { Metadata } from "next";
import Link from "next/link";
import { SignupChart } from "@/components/admin/signup-chart";
import { SubjectTag } from "@/components/ui/badges";
import { Facts, PageHeader, Section } from "@/components/ui/layout";
import { Notice } from "@/components/ui/notice";
import { formatRelative } from "@/lib/format";
import { requireRole } from "@/server/auth/session";
import { getAdminOverview, getTutoringOverview } from "@/server/queries/admin";

export const metadata: Metadata = { title: "Admin overview" };

export default async function AdminOverviewPage(props: PageProps<"/admin">) {
  await requireRole("ADMIN");
  const { notice } = await props.searchParams;
  const [{ counts, signups, reviewQueue, pending, audit }, tutoring] = await Promise.all([getAdminOverview(), getTutoringOverview()]);
  const newStudents = signups.reduce((sum, d) => sum + d.students, 0);

  return (
    <>
      <Notice value={notice} />
      <PageHeader title="Overview" description="How the platform is doing, and what needs you." />
      <div className="space-y-14">
        <div className="space-y-8">
          <Facts
            items={[
              { label: "Active students", value: counts.students },
              { label: "Active teachers", value: counts.teachers },
              { label: "Enrolments", value: counts.enrollments },
              { label: "Submissions this week", value: counts.submissionsWeek },
            ]}
          />
          <Facts
            items={[
              { label: "Published courses", value: counts.courses.PUBLISHED ?? 0 },
              { label: "Courses in review", value: counts.courses.IN_REVIEW ?? 0 },
              { label: "Teacher applications", value: counts.pendingTeachers },
              { label: "Work awaiting marking", value: counts.awaitingMarking },
            ]}
          />
          <Facts
            items={[
              { label: "Students with a teacher", value: tutoring.activePairs },
              { label: "Requests waiting on teachers", value: tutoring.pendingRequests },
              { label: "Sessions in the next 7 days", value: tutoring.sessionsThisWeek },
            ]}
          />
        </div>

        <Section title="New students, last 14 days" description={`${newStudents} new student account${newStudents === 1 ? "" : "s"} in the last two weeks.`}>
          <div className="border border-rule bg-sheet px-5 pt-5 pb-4">
            <SignupChart data={signups} />
          </div>
        </Section>

        <div className="grid grid-cols-1 gap-14 lg:grid-cols-2">
          <Section title="Courses waiting for review" actions={<Link href="/admin/review" className="text-base font-bold underline decoration-rule underline-offset-4">Review queue</Link>}>
            {reviewQueue.length === 0 ? (
              <p className="text-base text-muted">Nothing to review.</p>
            ) : (
              <ul className="divide-y divide-rule border-y border-rule">
                {reviewQueue.map((c) => (
                  <li key={c.id} className="py-3">
                    <Link href={`/admin/courses/${c.id}`} className="text-lg font-bold text-ink hover:underline hover:decoration-rule hover:underline-offset-4">
                      {c.title}
                    </Link>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-sm text-muted">
                      <SubjectTag name={c.subject.name} color={c.subject.color} />
                      <span>
                        {c.teacher.name}, submitted {c.submittedAt ? formatRelative(c.submittedAt) : ""}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Teacher applications">
            {pending.length === 0 ? (
              <p className="text-base text-muted">No applications waiting.</p>
            ) : (
              <ul className="divide-y divide-rule border-y border-rule">
                {pending.map((p) => (
                  <li key={p.id} className="flex items-baseline justify-between gap-3 py-3">
                    <Link href={`/admin/people/${p.id}`} className="text-lg font-bold text-ink hover:underline hover:decoration-rule hover:underline-offset-4">
                      {p.name}
                    </Link>
                    <span className="text-sm text-muted">
                      {p.applicationSubject?.name ?? "No subject"}, {formatRelative(p.createdAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>

        <Section title="Recent activity" actions={<Link href="/admin/activity" className="text-base font-bold underline decoration-rule underline-offset-4">Full log</Link>}>
          <ul className="divide-y divide-rule border-y border-rule">
            {audit.map((entry) => (
              <li key={entry.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2.5">
                <span className="text-base text-ink">{entry.summary}</span>
                <span className="text-sm text-muted">
                  {entry.actor?.name ?? "System"}, {formatRelative(entry.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      </div>
    </>
  );
}
