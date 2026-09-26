import Link from "next/link";
import type { CSSProperties } from "react";
import { plural } from "@/lib/format";
import { LEVEL_LABEL } from "@/lib/validation/course";
import type { CourseCard } from "@/server/queries/catalog";

/**
 * A course as a school exercise book: subject-coloured cover, a spine, and a
 * white label panel with the title written on its ruled lines.
 */
export function BookCover({ course, href }: { course: CourseCard; href?: string }) {
  const link = href ?? `/courses/${course.slug}`;
  return (
    <article className="group" style={{ "--subject": course.subject.color } as CSSProperties}>
      <Link href={link} className="block rounded-book focus-visible:outline-offset-4" aria-label={`${course.title}, ${course.subject.name}`}>
        <div className="relative flex aspect-[5/6] flex-col rounded-book bg-(--subject) p-4 pl-7 shadow-book">
          <p className="text-base font-extrabold tracking-[-0.01em] text-white/90">{course.subject.name}</p>
          <div className="mt-auto rounded-[2px] bg-sheet px-3 pt-2.5 pb-3 shadow-[0_1px_0_rgb(0_0_0/0.12)]">
            <p className="line-clamp-3 border-b border-rule pb-1 text-base leading-snug font-extrabold text-ink group-hover:underline group-hover:decoration-rule group-hover:underline-offset-4">
              {course.title}
            </p>
            <p className="truncate border-b border-rule pt-1.5 pb-1 text-sm font-bold text-ink-soft">{course.teacher.name}</p>
          </div>
        </div>
      </Link>
      <div className="mt-3 space-y-1 pr-2">
        <p className="line-clamp-2 text-base text-ink-soft">{course.summary}</p>
        <p className="figures text-sm text-muted">
          {LEVEL_LABEL[course.level]}, {plural(course._count.lessons, "lesson")}
        </p>
      </div>
    </article>
  );
}

export function Shelf({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-x-5 gap-y-10 sm:grid-cols-3 lg:grid-cols-4">{children}</div>;
}
