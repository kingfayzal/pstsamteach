import Link from "next/link";
import type { CSSProperties } from "react";
import type { CourseStatus } from "@/generated/prisma/enums";
import { CourseStatusBadge } from "@/components/ui/badges";
import { formatRelative, plural } from "@/lib/format";

type Row = {
  id: string;
  title: string;
  status: CourseStatus;
  reviewNote: string | null;
  updatedAt: Date;
  subject: { name: string; color: string };
  _count: { lessons: number; enrollments: number; assessments: number };
};

export function TeacherCourseList({ courses, hrefBase = "/teach/courses" }: { courses: Row[]; hrefBase?: string }) {
  return (
    <ul className="border-t border-rule">
      {courses.map((course) => (
        <li key={course.id} className="relative border-b border-rule py-4 pl-5" style={{ "--subject": course.subject.color } as CSSProperties}>
          <span aria-hidden="true" className="absolute top-4 bottom-4 left-0 w-1.5 rounded-full bg-(--subject)" />
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <Link href={`${hrefBase}/${course.id}`} className="text-lg font-extrabold text-ink hover:underline hover:decoration-rule hover:underline-offset-4">
                {course.title}
              </Link>
              <p className="figures text-sm text-muted">
                {course.subject.name}, {plural(course._count.lessons, "lesson")}, {plural(course._count.enrollments, "student")}. Edited {formatRelative(course.updatedAt)}.
              </p>
            </div>
            <CourseStatusBadge status={course.status} />
          </div>
          {course.status === "DRAFT" && course.reviewNote ? (
            <p className="mt-2 border-l-2 border-amber pl-3 text-sm text-ink-soft">
              <span className="font-bold text-amber">Sent back with notes: </span>
              {course.reviewNote}
            </p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
