import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { CSSProperties } from "react";
import { Markdown } from "@/components/course/markdown";
import { VideoEmbed } from "@/components/course/video-embed";
import { LessonCompleteToggle } from "@/components/forms/lesson-complete-toggle";
import { Breadcrumbs } from "@/components/ui/layout";
import { Tick } from "@/components/ui/marks";
import { formatMinutes } from "@/lib/format";
import { toggleLessonAction } from "@/server/actions/learning";
import { requireRole } from "@/server/auth/session";
import { getStudentLesson } from "@/server/queries/student";

export const metadata: Metadata = { title: "Lesson" };

export default async function LessonPage(props: PageProps<"/learn/courses/[slug]/lessons/[lessonId]">) {
  const user = await requireRole("STUDENT");
  const { slug, lessonId } = await props.params;
  const data = await getStudentLesson(user.id, slug, lessonId);
  if (!data) notFound();
  const { lesson, isComplete, completedIds, previous, next } = data;
  const course = lesson.course;
  const base = `/learn/courses/${course.slug}`;

  return (
    <div className="grid grid-cols-1 gap-12 xl:grid-cols-[minmax(0,1fr)_15rem]" style={{ "--subject": course.subject.color } as CSSProperties}>
      <article className="min-w-0">
        <Breadcrumbs items={[{ href: "/learn/courses", label: "My courses" }, { href: base, label: course.title }]} />
        <p className="text-sm text-muted">
          Lesson {lesson.position} of {course.lessons.length}, about {formatMinutes(lesson.durationMinutes)}
        </p>
        <h1 className="mt-2 mb-8 text-3xl text-ink sm:text-4xl">{lesson.title}</h1>

        {lesson.videoUrl ? (
          <div className="mb-10">
            <VideoEmbed url={lesson.videoUrl} title={lesson.title} />
          </div>
        ) : null}

        <Markdown>{lesson.body}</Markdown>

        <div className="mt-14 border-t border-rule pt-8">
          <LessonCompleteToggle key={String(isComplete)} action={toggleLessonAction.bind(null, lesson.id, course.slug)} isComplete={isComplete} />
        </div>

        <nav aria-label="Lesson navigation" className="mt-10 grid gap-4 sm:grid-cols-2">
          {previous ? (
            <Link href={`${base}/lessons/${previous.id}`} className="group border border-rule bg-sheet px-4 py-3">
              <span className="block text-sm text-muted">Previous lesson</span>
              <span className="block truncate text-base font-bold text-ink group-hover:underline group-hover:decoration-rule group-hover:underline-offset-4">{previous.title}</span>
            </Link>
          ) : (
            <span />
          )}
          {next ? (
            <Link href={`${base}/lessons/${next.id}`} className="group border border-rule bg-sheet px-4 py-3 sm:text-right">
              <span className="block text-sm text-muted">Next lesson</span>
              <span className="block truncate text-base font-bold text-ink group-hover:underline group-hover:decoration-rule group-hover:underline-offset-4">{next.title}</span>
            </Link>
          ) : (
            <Link href={base} className="group border border-rule bg-sheet px-4 py-3 sm:text-right">
              <span className="block text-sm text-muted">That was the last lesson</span>
              <span className="block text-base font-bold text-ink group-hover:underline group-hover:decoration-rule group-hover:underline-offset-4">Back to the course</span>
            </Link>
          )}
        </nav>
      </article>

      <aside className="hidden xl:block">
        <div className="sticky top-10">
          <p className="mb-3 text-sm font-bold text-ink-soft">In this course</p>
          <ol className="space-y-1 border-l-2 border-(--subject) pl-4">
            {course.lessons.map((l, i) => (
              <li key={l.id}>
                <Link
                  href={`${base}/lessons/${l.id}`}
                  aria-current={l.id === lesson.id ? "page" : undefined}
                  className={`flex items-start gap-2 py-1 text-sm ${l.id === lesson.id ? "font-bold text-ink" : "text-ink-soft hover:text-ink"}`}
                >
                  <span className="flex w-5 shrink-0 justify-center pt-0.5">
                    {completedIds.has(l.id) ? <Tick className="h-3.5 w-4" title="Done" /> : <span className="figures text-muted">{i + 1}</span>}
                  </span>
                  <span>{l.title}</span>
                </Link>
              </li>
            ))}
          </ol>
        </div>
      </aside>
    </div>
  );
}
