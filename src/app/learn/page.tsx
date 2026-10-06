import type { Metadata } from "next";
import Link from "next/link";
import { AnnouncementList } from "@/components/course/announcement-list";
import { EnrolledCourseRow } from "@/components/course/enrolled-course-row";
import { LinkButton } from "@/components/ui/button";
import { EmptyState, PageHeader, Section } from "@/components/ui/layout";
import { CircledScore } from "@/components/ui/marks";
import { Notice } from "@/components/ui/notice";
import { UpcomingSessions } from "@/components/teachers/upcoming-sessions";
import { formatDate, formatRelative } from "@/lib/format";
import { requireRole } from "@/server/auth/session";
import { getViewerTimeZone } from "@/server/auth/viewer";
import { listStudentConnections, listUpcomingSessions } from "@/server/queries/connections";
import { getRecentResults, getStudentAnnouncements, getStudentCourses } from "@/server/queries/student";
import { isLiveVideoEnabled } from "@/server/video";

export const metadata: Metadata = { title: "Dashboard" };

export default async function StudentDashboard(props: PageProps<"/learn">) {
  const user = await requireRole("STUDENT");
  const [{ notice }, courses, results, announcements, sessions, connections, timeZone] = await Promise.all([
    props.searchParams,
    getStudentCourses(user.id),
    getRecentResults(user.id),
    getStudentAnnouncements(user.id),
    listUpcomingSessions(user.id, "STUDENT", new Date(), { includeOpenRooms: isLiveVideoEnabled() }),
    listStudentConnections(user.id),
    getViewerTimeZone(),
  ]);
  const hasTeacher = connections.some((c) => c.status === "ACTIVE" || c.status === "PENDING");
  const inProgress = courses.filter((c) => !c.completedAt);
  const dueSoon = courses
    .flatMap((c) =>
      c.summary.assessments
        .filter((a) => a.dueAt && a.dueAt > new Date() && (a.state === "todo" || a.state === "retry"))
        .map((a) => ({ ...a, course: c.course })),
    )
    .sort((a, b) => (a.dueAt?.getTime() ?? 0) - (b.dueAt?.getTime() ?? 0))
    .slice(0, 5);
  const firstName = user.name.split(" ")[0];

  return (
    <>
      <Notice value={notice} />
      <PageHeader title={`Welcome back, ${firstName}`} description={inProgress.length ? "Here's where you left off." : "Find a course and make a start."} />

      <div className="space-y-14">
        <Section
          title="Upcoming sessions"
          actions={hasTeacher ? <Link href="/learn/teachers" className="text-base font-bold underline decoration-rule underline-offset-4">All your teachers</Link> : null}
        >
          {sessions.length ? (
            <UpcomingSessions sessions={sessions} timeZone={timeZone} linkBase="/learn/teachers" liveRoom={isLiveVideoEnabled()} />
          ) : hasTeacher ? (
            <p className="text-base text-muted">No sessions booked. Open a teacher to book your next one.</p>
          ) : (
            <div className="margin-sheet flex flex-col gap-4 border border-rule py-6 pr-6 pl-[4.5rem] sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-lg font-bold text-ink">Learn one to one with a teacher you choose</p>
                <p className="max-w-[56ch] text-base text-ink-soft">Read profiles, watch introductions, and book live sessions at times that suit you.</p>
              </div>
              <LinkButton href="/teachers">Find a teacher</LinkButton>
            </div>
          )}
        </Section>

        <Section title="Continue learning" actions={courses.length > inProgress.length ? <Link href="/learn/courses" className="text-base font-bold underline decoration-rule underline-offset-4">All my courses</Link> : null}>
          {inProgress.length === 0 ? (
            <EmptyState title={courses.length ? "You've finished everything you enrolled in" : "You haven't enrolled in a course yet"} action={<LinkButton href="/courses">Browse courses</LinkButton>}>
              Courses are free. Pick one in any subject to get started.
            </EmptyState>
          ) : (
            <ul className="border-t border-rule">
              {inProgress.map((c) => (
                <EnrolledCourseRow key={c.course.id} course={c.course} summary={c.summary} completedAt={c.completedAt} />
              ))}
            </ul>
          )}
        </Section>

        <div className="grid grid-cols-1 gap-14 lg:grid-cols-2">
          <Section title="Due soon">
            {dueSoon.length === 0 ? (
              <p className="text-base text-muted">Nothing due. Deadlines for assignments appear here.</p>
            ) : (
              <ul className="divide-y divide-rule border-y border-rule">
                {dueSoon.map((a) => (
                  <li key={a.id} className="flex items-baseline justify-between gap-4 py-3">
                    <div className="min-w-0">
                      <Link href={`/learn/courses/${a.course.slug}/assessments/${a.id}`} className="block truncate text-lg font-bold text-ink hover:underline hover:decoration-rule hover:underline-offset-4">
                        {a.title}
                      </Link>
                      <p className="truncate text-sm text-muted">{a.course.title}</p>
                    </div>
                    <p className="shrink-0 text-sm font-bold text-amber">Due {formatDate(a.dueAt)}</p>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Recent results" actions={results.length ? <Link href="/learn/grades" className="text-base font-bold underline decoration-rule underline-offset-4">All grades</Link> : null}>
            {results.length === 0 ? (
              <p className="text-base text-muted">Marked quizzes and assignments appear here.</p>
            ) : (
              <ul className="divide-y divide-rule border-y border-rule">
                {results.map((r) => (
                  <li key={r.id} className="flex items-center gap-4 py-3">
                    <CircledScore score={r.score ?? 0} maxScore={r.maxScore} passPercent={r.assessment.passPercent} size="sm" />
                    <div className="min-w-0">
                      <Link
                        href={`/learn/courses/${r.assessment.course.slug}/assessments/${r.assessment.id}`}
                        className="block truncate text-lg font-bold text-ink hover:underline hover:decoration-rule hover:underline-offset-4"
                      >
                        {r.assessment.title}
                      </Link>
                      <p className="truncate text-sm text-muted">
                        {r.assessment.course.title}, marked {r.gradedAt ? formatRelative(r.gradedAt) : ""}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>

        {announcements.length > 0 ? (
          <Section title="Announcements">
            <AnnouncementList items={announcements} />
          </Section>
        ) : null}
      </div>
    </>
  );
}
