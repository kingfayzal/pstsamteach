import { notFound } from "next/navigation";
import { CourseStatusBadge, SubjectTag } from "@/components/ui/badges";
import { ActionButton } from "@/components/ui/action-button";
import { Breadcrumbs } from "@/components/ui/layout";
import { NavLinks } from "@/components/shell/nav-links";
import { teacherCourseStatusAction } from "@/server/actions/teaching";
import { requireRole } from "@/server/auth/session";
import { getCourseForEditor } from "@/server/queries/teacher";

export default async function CourseEditorLayout({ children, params }: LayoutProps<"/teach/courses/[courseId]">) {
  const user = await requireRole("TEACHER");
  const { courseId } = await params;
  const data = await getCourseForEditor(user, courseId);
  if (!data) notFound();
  const { course, actions, blockers } = data;
  const base = `/teach/courses/${course.id}`;

  return (
    <>
      <Breadcrumbs items={[{ href: "/teach/courses", label: "Courses" }]} />
      <header className="mb-6 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <SubjectTag name={course.subject.name} color={course.subject.color} />
          <CourseStatusBadge status={course.status} />
        </div>
        <h1 className="text-3xl text-ink">{course.title}</h1>
      </header>

      <div className="mb-8 space-y-4 border border-rule bg-sheet px-5 py-4">
        {course.status === "DRAFT" && course.reviewNote ? (
          <div className="border-l-2 border-amber pl-3">
            <p className="text-sm font-bold text-amber">An admin sent this back with notes</p>
            <p className="text-base whitespace-pre-line text-ink">{course.reviewNote}</p>
          </div>
        ) : null}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-base text-ink-soft">
            {course.status === "DRAFT" && (blockers.length ? `Before you can submit: ${blockers.join(" ")}` : "Ready when you are. Submit it and an admin will review it.")}
            {course.status === "IN_REVIEW" && "An admin is reviewing this course. Editing is locked until they finish, or until you withdraw it."}
            {course.status === "PUBLISHED" && "Live in the catalog. Changes to lessons and quizzes appear to students straight away."}
            {course.status === "ARCHIVED" && "Archived. Enrolled students keep access, but nobody new can enrol. Ask an admin to restore it."}
          </p>
          <div className="flex shrink-0 gap-3">
            {actions.includes("submit") && blockers.length === 0 ? (
              <ActionButton action={teacherCourseStatusAction.bind(null, course.id, "submit")} label="Submit for review" pendingLabel="Submitting…" variant="primary" />
            ) : null}
            {actions.includes("withdraw") ? (
              <ActionButton action={teacherCourseStatusAction.bind(null, course.id, "withdraw")} label="Withdraw from review" pendingLabel="Withdrawing…" />
            ) : null}
          </div>
        </div>
      </div>

      <nav aria-label="Course sections" className="mb-8 border-b border-rule pb-3">
        <NavLinks
          orientation="horizontal"
          items={[
            { href: base, label: "Content", exact: true },
            { href: `${base}/details`, label: "Details" },
            { href: `${base}/students`, label: `Students (${course._count.enrollments})` },
            { href: `${base}/announcements`, label: "Announcements" },
          ]}
        />
      </nav>
      {children}
    </>
  );
}
