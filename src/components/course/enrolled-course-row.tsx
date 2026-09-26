import Link from "next/link";
import type { CSSProperties } from "react";
import { Tick, InkProgress } from "@/components/ui/marks";
import type { CourseSummary } from "@/server/queries/course-progress";

type Props = {
  course: { slug: string; title: string; status: string; subject: { name: string; color: string }; teacher: { name: string }; lessons: { id: string; title: string }[] };
  summary: CourseSummary;
  completedAt: Date | null;
};

/** One enrolled course as a row: spine colour, title, progress and the next step. */
export function EnrolledCourseRow({ course, summary, completedAt }: Props) {
  const next = course.lessons.find((l) => l.id === summary.nextLessonId);
  const nextAssessment = summary.assessments.find((a) => a.state === "todo" || a.state === "retry");
  const href = next
    ? `/learn/courses/${course.slug}/lessons/${next.id}`
    : nextAssessment
      ? `/learn/courses/${course.slug}/assessments/${nextAssessment.id}`
      : `/learn/courses/${course.slug}`;
  const nextLabel = completedAt ? "Review course" : next ? `Next: ${next.title}` : nextAssessment ? `Next: ${nextAssessment.title}` : "Open course";

  return (
    <li className="relative border-b border-rule py-5 pl-5" style={{ "--subject": course.subject.color } as CSSProperties}>
      <span aria-hidden="true" className="absolute top-5 bottom-5 left-0 w-1.5 rounded-full bg-(--subject)" />
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0 space-y-1">
          <p className="text-sm text-muted">
            {course.subject.name}, with {course.teacher.name}
            {course.status === "ARCHIVED" ? " (archived)" : ""}
          </p>
          <Link href={`/learn/courses/${course.slug}`} className="block text-xl font-extrabold text-ink hover:underline hover:decoration-rule hover:underline-offset-4">
            {course.title}
          </Link>
          {completedAt ? (
            <p className="flex items-center gap-1.5 text-base font-bold text-tick-text">
              <Tick className="h-4 w-4" /> Completed
            </p>
          ) : null}
        </div>
        <div className="w-full shrink-0 space-y-2 md:w-72">
          <InkProgress percent={summary.progress.percent} label={`${course.title} progress`} />
          <Link href={href} className="block truncate text-base font-bold text-ink underline decoration-rule underline-offset-4 hover:decoration-ink">
            {nextLabel}
          </Link>
        </div>
      </div>
    </li>
  );
}
