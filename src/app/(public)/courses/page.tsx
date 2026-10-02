import type { Metadata } from "next";
import Link from "next/link";
import type { CSSProperties } from "react";
import { BookCover, Shelf } from "@/components/brand/book-cover";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/layout";
import { listActiveSubjects, listCatalog } from "@/server/queries/catalog";

export const metadata: Metadata = {
  title: "Courses",
  description: "Browse courses with lessons, quizzes and assignments marked by real teachers.",
};

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function tabHref(subject: string | null, q: string | undefined): string {
  const params = new URLSearchParams();
  if (subject) params.set("subject", subject);
  if (q) params.set("q", q);
  const query = params.toString();
  return query ? `/courses?${query}` : "/courses";
}

export default async function CoursesPage(props: PageProps<"/courses">) {
  const searchParams = await props.searchParams;
  const subject = first(searchParams.subject);
  const q = first(searchParams.q)?.trim() || undefined;
  const [subjects, courses] = await Promise.all([listActiveSubjects(), listCatalog({ subject, q })]);
  const current = subjects.find((s) => s.slug === subject);

  return (
    <div className="mx-auto max-w-6xl px-4 pt-12 sm:px-8">
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
          <h1 className="text-4xl text-ink">{current ? current.name : "All courses"}</h1>
          <p className="max-w-[56ch] text-lg text-ink-soft">
            {current ? current.description : "Every published course, across every subject. Enrolment is free."}
          </p>
        </div>
        <form role="search" action="/courses" className="flex w-full max-w-md gap-2">
          {subject ? <input type="hidden" name="subject" value={subject} /> : null}
          <label htmlFor="q" className="sr-only">
            Search courses
          </label>
          <input
            id="q"
            name="q"
            type="search"
            defaultValue={q}
            placeholder="Search by title or topic"
            className="block w-full rounded-control border border-rule bg-sheet px-3 py-2.5 text-base text-ink placeholder:text-muted/70"
          />
          <Button type="submit" variant="secondary">
            Search
          </Button>
        </form>
      </div>

      <nav aria-label="Subjects" className="mt-10 border-b border-rule">
        <ul className="-mb-px flex flex-wrap gap-1">
          <li>
            <Link
              href={tabHref(null, q)}
              aria-current={!current ? "page" : undefined}
              className={`block rounded-t-[4px] border border-b-0 px-4 py-2.5 text-base font-bold ${!current ? "border-rule border-t-[3px] border-t-ink bg-paper text-ink" : "border-transparent text-ink-soft hover:text-ink"}`}
            >
              All subjects
            </Link>
          </li>
          {subjects.map((s) => {
            const active = current?.id === s.id;
            return (
              <li key={s.id} style={{ "--subject": s.color } as CSSProperties}>
                <Link
                  href={tabHref(s.slug, q)}
                  aria-current={active ? "page" : undefined}
                  className={`flex items-center gap-2 rounded-t-[4px] border border-b-0 px-4 py-2.5 text-base font-bold ${active ? "border-rule border-t-[3px] border-t-(--subject) bg-paper text-ink" : "border-transparent text-ink-soft hover:text-ink"}`}
                >
                  <span aria-hidden="true" className="h-3 w-3 rounded-[2px] bg-(--subject)" />
                  {s.name}
                  <span className="figures text-sm font-normal text-muted">{s._count.courses}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="pt-10">
        {q ? (
          <p className="mb-8 text-base text-ink-soft">
            {courses.length === 1 ? "1 course matches" : `${courses.length} courses match`} &ldquo;{q}&rdquo;.{" "}
            <Link href={tabHref(subject ?? null, undefined)} className="font-bold underline decoration-rule underline-offset-4 hover:decoration-ink">
              Clear search
            </Link>
          </p>
        ) : null}
        {courses.length === 0 ? (
          <EmptyState title={q ? "No courses match that search" : "No courses here yet"}>
            {q ? "Try a shorter word, or look in another subject." : "Teachers are writing courses for this subject now. Check back soon, or browse another subject."}
          </EmptyState>
        ) : (
          <Shelf>
            {courses.map((course) => (
              <BookCover key={course.id} course={course} />
            ))}
          </Shelf>
        )}
      </div>
    </div>
  );
}
