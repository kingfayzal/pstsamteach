import Link from "next/link";
import type { CSSProperties } from "react";
import { BookCover, Shelf } from "@/components/brand/book-cover";
import { MarkedWorksheet } from "@/components/brand/marked-worksheet";
import { LinkButton } from "@/components/ui/button";
import { plural } from "@/lib/format";
import { RatingSummary } from "@/components/teachers/rating";
import { TeacherAvatar } from "@/components/teachers/teacher-avatar";
import { getViewerTimeZone } from "@/server/auth/viewer";
import { listActiveSubjects, listFeaturedCourses } from "@/server/queries/catalog";
import { listDirectory } from "@/server/queries/teachers";

const STEPS = [
  { title: "Choose your teacher", body: "Read profiles, watch introductions and pick the teacher you connect with." },
  { title: "Learn live and in between", body: "Book one-to-one sessions at times that suit you, and work through courses in between." },
  { title: "Practise and hand work in", body: "Quizzes are marked the moment you submit. Written assignments go to your teacher." },
  { title: "Get it back, marked", body: "See your score and your teacher's comments, then try again if you need to." },
];

export default async function HomePage() {
  const timeZone = await getViewerTimeZone();
  const [subjects, featured, directory] = await Promise.all([
    listActiveSubjects(),
    listFeaturedCourses(3),
    listDirectory({ accepting: true, saved: false, sort: "recommended" }, { timeZone }),
  ]);
  const teachers = directory.slice(0, 3);

  return (
    <>
      <section className="mx-auto grid max-w-6xl items-center gap-14 px-4 pt-14 pb-20 sm:px-8 lg:grid-cols-[1.05fr_1fr] lg:pt-20">
        <div className="space-y-7">
          <h1 className="text-[3.25rem] leading-[0.98] tracking-[-0.04em] text-ink sm:text-5xl">
            Learn it.
            <br />
            Practise it.
            <br />
            Get it marked.
          </h1>
          <p className="max-w-[46ch] text-xl leading-relaxed text-ink-soft">
            English, Mathematics and Nursing with a teacher you choose yourself: live one-to-one sessions, courses, and work that comes back marked.
          </p>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
            <LinkButton href="/teachers">Find your teacher</LinkButton>
            <Link href="/courses" className="text-base font-bold text-ink underline decoration-rule decoration-2 underline-offset-4 hover:decoration-ink">
              Browse courses
            </Link>
          </div>
        </div>
        <MarkedWorksheet />
      </section>

      <section aria-labelledby="subjects-heading" className="border-y border-rule bg-sheet">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-8">
          <h2 id="subjects-heading" className="text-3xl text-ink">
            Pick a subject
          </h2>
          <ul className="mt-10 grid gap-8 md:grid-cols-3">
            {subjects.map((subject) => (
              <li key={subject.id} style={{ "--subject": subject.color } as CSSProperties}>
                <Link href={`/courses?subject=${subject.slug}`} className="group block rounded-book">
                  <div className="flex h-44 flex-col justify-between rounded-book bg-(--subject) p-5 pl-8 shadow-book">
                    <span className="text-3xl leading-none font-extrabold tracking-[-0.03em] text-white">{subject.name}</span>
                    <span className="self-start rounded-[2px] bg-sheet px-3 py-1.5 text-sm font-bold text-ink">
                      {plural(subject._count.courses, "course")}
                    </span>
                  </div>
                  <p className="mt-4 text-lg font-bold text-ink group-hover:underline group-hover:decoration-rule group-hover:underline-offset-4">
                    {subject.tagline}
                  </p>
                  <p className="mt-1 text-base text-ink-soft">{subject.description}</p>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {teachers.length > 0 ? (
        <section aria-labelledby="teachers-heading" className="mx-auto max-w-6xl px-4 pt-20 sm:px-8">
          <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
            <div className="space-y-2">
              <h2 id="teachers-heading" className="text-3xl text-ink">
                Meet some of our teachers
              </h2>
              <p className="max-w-[56ch] text-lg text-ink-soft">Every teacher is approved by our team. Pick the one whose way of explaining clicks with you.</p>
            </div>
            <Link href="/teachers" className="text-base font-bold text-ink underline decoration-rule decoration-2 underline-offset-4 hover:decoration-ink">
              See every teacher
            </Link>
          </div>
          <ul className="grid grid-cols-1 gap-x-10 gap-y-10 md:grid-cols-3">
            {teachers.map((t) => (
              <li key={t.profileId} className="space-y-3">
                <Link href={`/teachers/${t.slug}`} className="group flex items-center gap-4">
                  <TeacherAvatar name={t.name} photo={t.photo} color={t.subjects[0]?.color} size="md" />
                  <span>
                    <span className="block text-lg font-extrabold text-ink group-hover:underline group-hover:decoration-rule group-hover:underline-offset-4">{t.name}</span>
                    <span className="block text-sm text-muted">{t.subjects.map((s) => s.name).join(", ")}</span>
                  </span>
                </Link>
                <p className="text-base font-bold text-ink-soft">{t.headline}</p>
                <RatingSummary average={t.average} count={t.reviewCount} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="how-heading" className="mx-auto max-w-6xl px-4 py-20 sm:px-8">
        <h2 id="how-heading" className="text-3xl text-ink">
          How it works
        </h2>
        <ol className="mt-10 grid grid-cols-1 gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, index) => (
            <li key={step.title} className="border-t-2 border-ink pt-4">
              <span className="hand text-2xl text-tick-text">{index + 1}.</span>
              <h3 className="mt-1 text-xl text-ink">{step.title}</h3>
              <p className="mt-2 text-base text-ink-soft">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      {featured.length > 0 ? (
        <section aria-labelledby="featured-heading" className="mx-auto max-w-6xl px-4 pb-8 sm:px-8">
          <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
            <h2 id="featured-heading" className="text-3xl text-ink">
              Start with one of these
            </h2>
            <Link href="/courses" className="text-base font-bold text-ink underline decoration-rule decoration-2 underline-offset-4 hover:decoration-ink">
              See every course
            </Link>
          </div>
          <Shelf>
            {featured.map((course) => (
              <BookCover key={course.id} course={course} />
            ))}
          </Shelf>
        </section>
      ) : null}

      <section aria-labelledby="teach-heading" className="mx-auto mt-16 max-w-6xl px-4 sm:px-8">
        <div className="margin-sheet grid gap-6 border border-rule px-6 py-10 pl-[4.5rem] sm:grid-cols-[1fr_auto] sm:items-center sm:pr-10">
          <div className="space-y-2">
            <h2 id="teach-heading" className="text-2xl text-ink">
              Teach what you know
            </h2>
            <p className="max-w-[56ch] text-lg text-ink-soft">
              Write lessons, set quizzes and assignments, and mark your students&rsquo; work. Every teacher is approved by our team before their first course goes live.
            </p>
          </div>
          <LinkButton href="/teach-with-us" variant="secondary">
            How teaching works
          </LinkButton>
        </div>
      </section>
    </>
  );
}
