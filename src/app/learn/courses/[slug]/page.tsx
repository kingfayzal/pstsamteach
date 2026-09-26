import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { CSSProperties } from "react";
import { AnnouncementList } from "@/components/course/announcement-list";
import { AssessmentStateBadge, SubjectTag } from "@/components/ui/badges";
import { LinkButton } from "@/components/ui/button";
import { PageHeader, Section } from "@/components/ui/layout";
import { InkProgress, Tick } from "@/components/ui/marks";
import { Notice } from "@/components/ui/notice";
import { formatDate, formatMinutes, plural } from "@/lib/format";
import { requireRole } from "@/server/auth/session";
import { getStudentCourse } from "@/server/queries/student";

export const metadata: Metadata = { title: "Course" };

export default async function StudentCoursePage(props: PageProps<"/learn/courses/[slug]">) {
  const user = await requireRole("STUDENT");
  const [{ slug }, { notice }] = await Promise.all([props.params, props.searchParams]);
  const data = await getStudentCourse(user.id, slug);
  if (!data) notFound();
  const { course, summary } = data;
  const { progress } = summary;
  const nextLesson = course.lessons.find((l) => l.id === summary.nextLessonId);

  return (
    <div style={{ "--subject": course.subject.color } as CSSProperties}>
      <Notice value={notice} />
      <PageHeader
        crumbs={[{ href: "/learn/courses", label: "My courses" }]}
        title={course.title}
        description={course.summary}
        meta={
          <>
            <SubjectTag name={course.subject.name} color={course.subject.color} />
            <span className="text-sm text-muted">Taught by {course.teacher.name}</span>
            {course.status === "ARCHIVED" ? <span className="text-sm font-bold text-amber">Archived: you keep access, but it&rsquo;s no longer in the catalog.</span> : null}
          </>
        }
        actions={nextLesson ? <LinkButton href={`/learn/courses/${course.slug}/lessons/${nextLesson.id}`}>{progress.completedLessons === 0 ? "Start first lesson" : "Continue"}</LinkButton> : null}
      />

      <div className="mb-12 max-w-xl space-y-2">
        <InkProgress percent={progress.percent} label="Course progress" />
        <p className="figures text-sm text-muted">
          {progress.completedLessons} of {plural(progress.totalLessons, "lesson")} done
          {progress.totalAssessments ? `, ${progress.passedAssessments} of ${progress.totalAssessments} passed` : ""}
          {progress.isComplete ? ". Course complete." : "."}
        </p>
      </div>

      <div className="grid gap-14 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="space-y-14">
          <Section title="Lessons">
            <ol className="border-t border-rule">
              {course.lessons.map((lesson, index) => {
                const done = summary.completedLessonIds.has(lesson.id);
                return (
                  <li key={lesson.id} className="border-b border-rule">
                    <Link href={`/learn/courses/${course.slug}/lessons/${lesson.id}`} className="group flex items-center gap-4 py-3.5">
                      <span className="flex w-7 shrink-0 justify-center">
                        {done ? <Tick className="h-5 w-6" title="Done" /> : <span className="figures text-sm text-muted">{index + 1}</span>}
                      </span>
                      <span className={`flex-1 text-lg group-hover:underline group-hover:decoration-rule group-hover:underline-offset-4 ${done ? "text-ink-soft" : "font-bold text-ink"}`}>
                        {lesson.title}
                      </span>
                      <span className="figures shrink-0 text-sm text-muted">{formatMinutes(lesson.durationMinutes)}</span>
                    </Link>
                  </li>
                );
              })}
            </ol>
          </Section>

          {summary.assessments.length > 0 ? (
            <Section title="Quizzes and assignments">
              <ul className="border-t border-rule">
                {summary.assessments.map((a) => (
                  <li key={a.id} className="flex flex-col gap-2 border-b border-rule py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-sm text-muted">
                        {a.kind === "QUIZ" ? "Quiz, marked instantly" : "Assignment, marked by your teacher"}
                        {a.dueAt ? `. Due ${formatDate(a.dueAt)}` : ""}
                      </p>
                      <Link href={`/learn/courses/${course.slug}/assessments/${a.id}`} className="text-lg font-bold text-ink hover:underline hover:decoration-rule hover:underline-offset-4">
                        {a.title}
                      </Link>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      {a.best ? (
                        <span className="figures text-sm text-ink-soft">
                          Best {a.best.score}/{a.best.maxScore}
                        </span>
                      ) : null}
                      <AssessmentStateBadge state={a.state} />
                    </div>
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}
        </div>

        <aside className="space-y-4">
          <h2 className="text-xl text-ink">From your teacher</h2>
          {course.announcements.length ? (
            <AnnouncementList items={course.announcements} />
          ) : (
            <p className="text-base text-muted">No announcements yet. Your teacher&rsquo;s updates for this course appear here.</p>
          )}
        </aside>
      </div>
    </div>
  );
}
