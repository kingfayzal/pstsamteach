import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Markdown } from "@/components/course/markdown";
import { VideoEmbed } from "@/components/course/video-embed";
import { ReviewNoteForm } from "@/components/forms/simple-forms";
import { ActionButton } from "@/components/ui/action-button";
import { CourseStatusBadge, Pill, SubjectTag } from "@/components/ui/badges";
import { Notice } from "@/components/ui/notice";
import { PageHeader, Section } from "@/components/ui/layout";
import { availableActions } from "@/lib/course-lifecycle";
import { formatDate, formatMinutes, plural } from "@/lib/format";
import { LEVEL_LABEL } from "@/lib/validation/course";
import { adminCourseStatusAction, featureCourseAction } from "@/server/actions/admin";
import { requireRole } from "@/server/auth/session";
import { getCourseForReview } from "@/server/queries/admin";

export const metadata: Metadata = { title: "Review course" };

export default async function AdminCoursePage(props: PageProps<"/admin/courses/[courseId]">) {
  const admin = await requireRole("ADMIN");
  const [{ courseId }, { notice }] = await Promise.all([props.params, props.searchParams]);
  const course = await getCourseForReview(courseId);
  if (!course) notFound();
  const actions = availableActions(course.status, admin.role);

  return (
    <>
      <Notice value={notice} />
      <PageHeader
        crumbs={[{ href: "/admin/courses", label: "Courses" }]}
        title={course.title}
        description={course.summary}
        meta={
          <>
            <SubjectTag name={course.subject.name} color={course.subject.color} />
            <CourseStatusBadge status={course.status} />
            <span className="text-sm text-muted">
              By{" "}
              <Link href={`/admin/people/${course.teacher.id}`} className="font-bold text-ink-soft underline decoration-rule underline-offset-4">
                {course.teacher.name}
              </Link>
              , {LEVEL_LABEL[course.level]}, {plural(course._count.enrollments, "student")}
              {course.publishedAt ? `, published ${formatDate(course.publishedAt)}` : ""}
            </span>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-14">
          <Section title="Description">
            <Markdown>{course.description}</Markdown>
          </Section>

          <Section title={`Lessons (${course.lessons.length})`} description="Open each one to read it as a student would.">
            <ol className="space-y-3">
              {course.lessons.map((lesson, i) => (
                <li key={lesson.id} className="border border-rule bg-sheet">
                  <details>
                    <summary className="flex cursor-pointer items-baseline gap-3 px-5 py-3">
                      <span className="figures text-sm text-muted">{i + 1}.</span>
                      <span className="flex-1 text-lg font-bold text-ink">{lesson.title}</span>
                      <span className="figures text-sm text-muted">{formatMinutes(lesson.durationMinutes)}</span>
                    </summary>
                    <div className="space-y-6 border-t border-rule px-5 py-6">
                      {lesson.videoUrl ? <VideoEmbed url={lesson.videoUrl} title={lesson.title} /> : null}
                      <Markdown>{lesson.body}</Markdown>
                    </div>
                  </details>
                </li>
              ))}
            </ol>
          </Section>

          {course.assessments.length > 0 ? (
            <Section title="Quizzes and assignments">
              <ul className="space-y-3">
                {course.assessments.map((a) => (
                  <li key={a.id} className="border border-rule bg-sheet">
                    <details>
                      <summary className="flex cursor-pointer flex-wrap items-baseline gap-3 px-5 py-3">
                        <span className="flex-1 text-lg font-bold text-ink">{a.title}</span>
                        <span className="text-sm text-muted">{a.kind === "QUIZ" ? plural(a.questions.length, "question") : `Out of ${a.maxPoints}`}</span>
                        <Pill tone={a.isPublished ? "good" : "neutral"}>{a.isPublished ? "Visible" : "Hidden"}</Pill>
                      </summary>
                      <div className="space-y-5 border-t border-rule px-5 py-5">
                        <Markdown className="prose-lesson text-base">{a.instructions}</Markdown>
                        {a.questions.length ? (
                          <ol className="space-y-4">
                            {a.questions.map((q, qi) => (
                              <li key={q.id}>
                                <p className="font-bold text-ink">
                                  {qi + 1}. {q.prompt}
                                </p>
                                <ul className="mt-1 pl-5">
                                  {q.options.map((o) => (
                                    <li key={o.id} className={o.isCorrect ? "font-bold text-tick-text" : "text-ink-soft"}>
                                      {o.label}
                                      {o.isCorrect ? " (correct)" : ""}
                                    </li>
                                  ))}
                                </ul>
                              </li>
                            ))}
                          </ol>
                        ) : null}
                      </div>
                    </details>
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}
        </div>

        <aside className="space-y-6 lg:sticky lg:top-10 lg:self-start">
          <div className="space-y-5 border border-rule bg-sheet p-5">
            <h2 className="text-xl text-ink">Decision</h2>
            {course.status === "DRAFT" ? (
              <p className="text-base text-ink-soft">
                The teacher is still working on this draft.
                {course.reviewNote ? " Your last notes are below." : ""}
              </p>
            ) : null}
            {course.reviewNote && course.status === "DRAFT" ? <p className="border-l-2 border-amber pl-3 text-sm whitespace-pre-line text-ink-soft">{course.reviewNote}</p> : null}
            {actions.includes("approve") ? (
              <ActionButton action={adminCourseStatusAction.bind(null, course.id, "approve")} label="Approve and publish" pendingLabel="Publishing…" variant="primary" size="md" />
            ) : null}
            {actions.includes("reject") ? <ReviewNoteForm action={adminCourseStatusAction.bind(null, course.id, "reject")} /> : null}
            {actions.includes("restore") ? (
              <ActionButton action={adminCourseStatusAction.bind(null, course.id, "restore")} label="Restore to catalog" pendingLabel="Restoring…" variant="primary" />
            ) : null}
            {course.status === "PUBLISHED" ? (
              <div className="space-y-4">
                <ActionButton
                  action={featureCourseAction.bind(null, course.id, !course.isFeatured)}
                  label={course.isFeatured ? "Remove from home page" : "Feature on home page"}
                  pendingLabel="Saving…"
                />
                <div className="flex flex-wrap gap-3 border-t border-rule pt-4">
                  <ActionButton
                    action={adminCourseStatusAction.bind(null, course.id, "unpublish")}
                    label="Unpublish"
                    pendingLabel="Unpublishing…"
                    confirm="Unpublish this course? It goes back to draft and leaves the catalog. Enrolled students lose access until it's republished."
                  />
                  <ActionButton
                    action={adminCourseStatusAction.bind(null, course.id, "archive")}
                    label="Archive"
                    pendingLabel="Archiving…"
                    variant="danger"
                    confirm="Archive this course? Enrolled students keep access, but nobody new can enrol."
                  />
                </div>
              </div>
            ) : null}
            {course.status === "PUBLISHED" ? (
              <Link href={`/courses/${course.slug}`} className="block text-sm font-bold text-ink-soft underline decoration-rule underline-offset-4">
                View the public course page
              </Link>
            ) : null}
          </div>
          <p className="text-sm text-muted">
            Contact the teacher at{" "}
            <a href={`mailto:${course.teacher.email}`} className="font-bold text-ink-soft underline decoration-rule underline-offset-4">
              {course.teacher.email}
            </a>
            .
          </p>
        </aside>
      </div>
    </>
  );
}
