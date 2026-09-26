import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { CSSProperties } from "react";
import { Markdown } from "@/components/course/markdown";
import { ActionButton } from "@/components/ui/action-button";
import { SubjectTag } from "@/components/ui/badges";
import { LinkButton } from "@/components/ui/button";
import { Breadcrumbs } from "@/components/ui/layout";
import { formatMinutes, plural } from "@/lib/format";
import { LEVEL_LABEL } from "@/lib/validation/course";
import { enrollAction } from "@/server/actions/learning";
import { getCurrentUser } from "@/server/auth/session";
import { getPublicCourse, isEnrolled } from "@/server/queries/catalog";
import type { Actor } from "@/server/services/result";

export async function generateMetadata(props: PageProps<"/courses/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const course = await getPublicCourse(slug);
  return course ? { title: course.title, description: course.summary } : { title: "Course not found" };
}

async function EnrolPanel({ courseId, slug, user }: { courseId: string; slug: string; user: Actor | null }) {
  if (!user) {
    return (
      <div className="space-y-3">
        <LinkButton href={`/signup?next=/courses/${slug}`} className="w-full">
          Create an account to enrol
        </LinkButton>
        <p className="text-center text-sm text-muted">
          Already have one?{" "}
          <Link href={`/login?next=/courses/${slug}`} className="font-bold text-ink underline decoration-rule underline-offset-4">
            Log in
          </Link>
        </p>
      </div>
    );
  }
  if (user.role !== "STUDENT") {
    return <p className="text-base text-ink-soft">You&rsquo;re signed in as a {user.role.toLowerCase()}. Enrolment is for student accounts.</p>;
  }
  if (await isEnrolled(user.id, courseId)) {
    return (
      <LinkButton href={`/learn/courses/${slug}`} className="w-full">
        Continue course
      </LinkButton>
    );
  }
  return <ActionButton action={enrollAction.bind(null, courseId)} label="Enrol in course" pendingLabel="Enrolling…" variant="primary" size="md" className="w-full [&_button]:w-full" />;
}

export default async function CoursePage(props: PageProps<"/courses/[slug]">) {
  const { slug } = await props.params;
  const [course, user] = await Promise.all([getPublicCourse(slug), getCurrentUser()]);
  if (!course) notFound();
  const minutes = course.lessons.reduce((sum, l) => sum + l.durationMinutes, 0);
  const quizzes = course.assessments.filter((a) => a.kind === "QUIZ").length;
  const assignments = course.assessments.length - quizzes;

  return (
    <div className="mx-auto max-w-6xl px-4 pt-10 sm:px-8" style={{ "--subject": course.subject.color } as CSSProperties}>
      <Breadcrumbs
        items={[
          { href: "/courses", label: "Courses" },
          { href: `/courses?subject=${course.subject.slug}`, label: course.subject.name },
        ]}
      />
      <div className="grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0">
          <SubjectTag name={course.subject.name} color={course.subject.color} />
          <h1 className="mt-3 text-4xl text-ink">{course.title}</h1>
          <p className="mt-4 max-w-[60ch] text-xl text-ink-soft">{course.summary}</p>

          <div className="mt-10">
            <Markdown>{course.description}</Markdown>
          </div>

          <section aria-labelledby="inside-heading" className="mt-14">
            <h2 id="inside-heading" className="text-2xl text-ink">
              What&rsquo;s inside
            </h2>
            <ol className="mt-5 border-t border-rule">
              {course.lessons.map((lesson, index) => (
                <li key={lesson.id} className="flex items-baseline gap-4 border-b border-rule py-3">
                  <span className="figures w-6 shrink-0 text-right text-sm text-muted">{index + 1}</span>
                  <span className="flex-1 text-lg text-ink">{lesson.title}</span>
                  <span className="figures shrink-0 text-sm text-muted">{formatMinutes(lesson.durationMinutes)}</span>
                </li>
              ))}
            </ol>
            {course.assessments.length > 0 ? (
              <ul className="mt-6 space-y-2">
                {course.assessments.map((a) => (
                  <li key={a.id} className="flex items-baseline gap-3 text-lg text-ink">
                    <span className="w-28 shrink-0 text-sm font-bold text-muted">{a.kind === "QUIZ" ? "Quiz" : "Assignment"}</span>
                    {a.title}
                  </li>
                ))}
              </ul>
            ) : null}
          </section>

          {course.teacher.bio ? (
            <section aria-labelledby="teacher-heading" className="mt-14 border-t border-rule pt-8">
              <h2 id="teacher-heading" className="text-2xl text-ink">
                Your teacher, {course.teacher.name}
              </h2>
              <p className="mt-3 max-w-[62ch] text-lg text-ink-soft">{course.teacher.bio}</p>
            </section>
          ) : null}
        </div>

        <aside className="lg:pt-8">
          <div className="space-y-6 border border-rule bg-sheet p-6 lg:sticky lg:top-8">
            <div className="h-2 rounded-full bg-(--subject)" aria-hidden="true" />
            <dl className="grid grid-cols-2 gap-4">
              <div>
                <dt className="text-sm text-muted">Level</dt>
                <dd className="text-lg font-bold text-ink">{LEVEL_LABEL[course.level]}</dd>
              </div>
              <div>
                <dt className="text-sm text-muted">Time</dt>
                <dd className="figures text-lg font-bold text-ink">{formatMinutes(minutes)}</dd>
              </div>
              <div>
                <dt className="text-sm text-muted">Lessons</dt>
                <dd className="figures text-lg font-bold text-ink">{course.lessons.length}</dd>
              </div>
              <div>
                <dt className="text-sm text-muted">Practice</dt>
                <dd className="text-lg font-bold text-ink">
                  {quizzes || assignments ? [quizzes ? plural(quizzes, "quiz", "quizzes") : null, assignments ? plural(assignments, "assignment") : null].filter(Boolean).join(", ") : "None yet"}
                </dd>
              </div>
            </dl>
            <p className="text-sm text-muted">
              Taught by <span className="font-bold text-ink-soft">{course.teacher.name}</span>. {plural(course._count.enrollments, "student")} enrolled.
            </p>
            <EnrolPanel courseId={course.id} slug={course.slug} user={user} />
          </div>
        </aside>
      </div>
    </div>
  );
}
