import type { Metadata } from "next";
import Link from "next/link";
import { AnnouncementList } from "@/components/course/announcement-list";
import { TeacherCourseList } from "@/components/course/teacher-course-list";
import { LinkButton } from "@/components/ui/button";
import { EmptyState, Facts, PageHeader, Section } from "@/components/ui/layout";
import { UpcomingSessions } from "@/components/teachers/upcoming-sessions";
import { formatRelative } from "@/lib/format";
import { requireRole } from "@/server/auth/session";
import { getViewerTimeZone } from "@/server/auth/viewer";
import { listTeacherConnections, listUpcomingSessions } from "@/server/queries/connections";
import { getMarkingQueue, getTeacherAnnouncements, getTeacherCourses, getTeacherStats } from "@/server/queries/teacher";

export const metadata: Metadata = { title: "Teacher dashboard" };

export default async function TeacherDashboard() {
  const user = await requireRole("TEACHER");
  const [stats, courses, queue, announcements] = await Promise.all([
    getTeacherStats(user),
    getTeacherCourses(user),
    getMarkingQueue(user, 5),
    getTeacherAnnouncements(3),
  ]);
  const [sessions, students, timeZone] = await Promise.all([listUpcomingSessions(user.id, "TEACHER"), listTeacherConnections(user.id), getViewerTimeZone()]);

  return (
    <>
      <PageHeader
        title={`Hello, ${user.name.split(" ")[0]}`}
        description={stats.awaiting ? `You have ${stats.awaiting} piece${stats.awaiting === 1 ? "" : "s"} of work waiting to be marked.` : "Nothing waiting to be marked. Nice."}
        actions={<LinkButton href="/teach/courses/new">New course</LinkButton>}
      />

      <div className="space-y-14">
        {students.pending.length ? (
          <div className="flex flex-col gap-3 border border-amber/30 bg-amber-wash px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-base font-bold text-amber">
              {students.pending.length === 1 ? "1 student has" : `${students.pending.length} students have`} asked you to be their teacher.
            </p>
            <LinkButton href="/teach/students" size="sm">
              Review requests
            </LinkButton>
          </div>
        ) : null}
        <Facts
          items={[
            { label: "Students enrolled", value: stats.students },
            { label: "Published courses", value: stats.published },
            { label: "Waiting to be marked", value: stats.awaiting },
          ]}
        />

        <Section title="Upcoming sessions" actions={<Link href="/teach/students" className="text-base font-bold underline decoration-rule underline-offset-4">Your students</Link>}>
          {sessions.length ? (
            <UpcomingSessions sessions={sessions} timeZone={timeZone} linkBase="/teach/students" />
          ) : (
            <p className="text-base text-muted">
              No live sessions booked.{" "}
              <Link href="/teach/profile" className="font-bold text-ink underline decoration-rule underline-offset-4">
                Keep your profile and availability up to date
              </Link>{" "}
              so students can find and book you.
            </p>
          )}
        </Section>

        <Section title="Marking queue" actions={queue.length ? <Link href="/teach/marking" className="text-base font-bold underline decoration-rule underline-offset-4">See all</Link> : null}>
          {queue.length === 0 ? (
            <p className="text-base text-muted">When students hand in assignments, they&rsquo;ll appear here, oldest first.</p>
          ) : (
            <ul className="divide-y divide-rule border-y border-rule">
              {queue.map((item) => (
                <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="text-lg font-bold text-ink">{item.student.name}</p>
                    <p className="text-sm text-muted">
                      {item.assessment.title}, {item.assessment.course.title}. Handed in {formatRelative(item.submittedAt)}.
                    </p>
                  </div>
                  <LinkButton href={`/teach/marking/${item.id}`} variant="secondary" size="sm">
                    Mark
                  </LinkButton>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Your courses">
          {courses.length === 0 ? (
            <EmptyState title="You haven't made a course yet" action={<LinkButton href="/teach/courses/new">Create your first course</LinkButton>}>
              Start with a title and a subject. You can add lessons and quizzes next, then submit it for review.
            </EmptyState>
          ) : (
            <TeacherCourseList courses={courses} />
          )}
        </Section>

        {announcements.length ? (
          <Section title="From the platform team">
            <AnnouncementList items={announcements} />
          </Section>
        ) : null}
      </div>
    </>
  );
}
