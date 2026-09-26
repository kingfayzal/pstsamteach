import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionButton } from "@/components/ui/action-button";
import { Pill } from "@/components/ui/badges";
import { LinkButton } from "@/components/ui/button";
import { EmptyState, Section } from "@/components/ui/layout";
import { Notice } from "@/components/ui/notice";
import { canTeacherEditContent } from "@/lib/course-lifecycle";
import { formatDate, formatMinutes, plural } from "@/lib/format";
import { moveLessonAction } from "@/server/actions/teaching";
import { requireRole } from "@/server/auth/session";
import { getCourseForEditor } from "@/server/queries/teacher";

export const metadata: Metadata = { title: "Course content" };

export default async function CourseContentPage(props: PageProps<"/teach/courses/[courseId]">) {
  const user = await requireRole("TEACHER");
  const [{ courseId }, { notice }] = await Promise.all([props.params, props.searchParams]);
  const data = await getCourseForEditor(user, courseId);
  if (!data) notFound();
  const { course } = data;
  const editable = canTeacherEditContent(course.status);
  const base = `/teach/courses/${course.id}`;

  return (
    <div className="space-y-14">
      <Notice value={notice} />

      <Section
        title="Lessons"
        description={course.lessons.length ? `${plural(course.lessons.length, "lesson")}, about ${formatMinutes(course.lessons.reduce((s, l) => s + l.durationMinutes, 0))} in total.` : undefined}
        actions={editable ? <LinkButton href={`${base}/lessons/new`} size="sm">Add lesson</LinkButton> : null}
      >
        {course.lessons.length === 0 ? (
          <EmptyState title="No lessons yet" action={editable ? <LinkButton href={`${base}/lessons/new`}>Write the first lesson</LinkButton> : null}>
            Lessons are short pages of text, with an optional video.
          </EmptyState>
        ) : (
          <ol className="border-t border-rule">
            {course.lessons.map((lesson, index) => (
              <li key={lesson.id} className="flex flex-wrap items-center gap-3 border-b border-rule py-3">
                <span className="figures w-6 text-right text-sm text-muted">{index + 1}</span>
                <div className="min-w-0 flex-1">
                  <Link href={`${base}/lessons/${lesson.id}`} className="text-lg font-bold text-ink hover:underline hover:decoration-rule hover:underline-offset-4">
                    {lesson.title}
                  </Link>
                  <p className="text-sm text-muted">
                    {formatMinutes(lesson.durationMinutes)}
                    {lesson.videoUrl ? ", with video" : ""}
                  </p>
                </div>
                {editable ? (
                  <div className="flex items-center gap-1">
                    {index > 0 ? <ActionButton action={moveLessonAction.bind(null, course.id, lesson.id, "up")} label="Move up" pendingLabel="Moving…" variant="quiet" className="text-sm" /> : null}
                    {index < course.lessons.length - 1 ? (
                      <ActionButton action={moveLessonAction.bind(null, course.id, lesson.id, "down")} label="Move down" pendingLabel="Moving…" variant="quiet" className="ml-3 text-sm" />
                    ) : null}
                  </div>
                ) : null}
              </li>
            ))}
          </ol>
        )}
      </Section>

      <Section
        title="Quizzes and assignments"
        description="Quizzes are multiple choice and mark themselves. Assignments are written answers you mark."
        actions={
          editable ? (
            <div className="flex gap-3">
              <LinkButton href={`${base}/assessments/new?kind=QUIZ`} size="sm" variant="secondary">
                Add quiz
              </LinkButton>
              <LinkButton href={`${base}/assessments/new?kind=ASSIGNMENT`} size="sm" variant="secondary">
                Add assignment
              </LinkButton>
            </div>
          ) : null
        }
      >
        {course.assessments.length === 0 ? (
          <p className="text-base text-muted">None yet. Courses don&rsquo;t need them, but practice helps students remember.</p>
        ) : (
          <ul className="border-t border-rule">
            {course.assessments.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-rule py-3">
                <div className="min-w-0">
                  <Link href={`${base}/assessments/${a.id}`} className="text-lg font-bold text-ink hover:underline hover:decoration-rule hover:underline-offset-4">
                    {a.title}
                  </Link>
                  <p className="text-sm text-muted">
                    {a.kind === "QUIZ" ? `Quiz, ${plural(a._count.questions, "question")}` : "Assignment"}, {plural(a._count.submissions, "submission")}
                    {a.dueAt ? `. Due ${formatDate(a.dueAt)}` : ""}
                  </p>
                </div>
                <Pill tone={a.isPublished ? "good" : "neutral"}>{a.isPublished ? "Visible to students" : "Hidden"}</Pill>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {course.status === "PUBLISHED" ? (
        <p className="text-base text-ink-soft">
          See it as students do:{" "}
          <Link href={`/courses/${course.slug}`} className="font-bold text-ink underline decoration-rule underline-offset-4">
            open the public course page
          </Link>
          .
        </p>
      ) : null}
    </div>
  );
}
