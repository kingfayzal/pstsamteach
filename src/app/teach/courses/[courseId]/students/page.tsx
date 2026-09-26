import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EmptyState } from "@/components/ui/layout";
import { InkProgress, Tick } from "@/components/ui/marks";
import { formatDate, formatRelative } from "@/lib/format";
import { requireRole } from "@/server/auth/session";
import { getCourseRoster } from "@/server/queries/teacher";

export const metadata: Metadata = { title: "Students" };

export default async function CourseStudentsPage(props: PageProps<"/teach/courses/[courseId]/students">) {
  const user = await requireRole("TEACHER");
  const { courseId } = await props.params;
  const roster = await getCourseRoster(user, courseId);
  if (!roster) notFound();

  if (roster.rows.length === 0) {
    return <EmptyState title="Nobody has enrolled yet">Once the course is published, students who enrol will be listed here with their progress.</EmptyState>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[44rem] border-collapse text-left">
        <thead>
          <tr className="border-b-2 border-ink text-sm text-ink-soft">
            <th scope="col" className="py-2 pr-4 font-bold">Student</th>
            <th scope="col" className="w-64 py-2 pr-4 font-bold">Progress</th>
            <th scope="col" className="py-2 pr-4 font-bold">Enrolled</th>
            <th scope="col" className="py-2 font-bold">Last active</th>
          </tr>
        </thead>
        <tbody>
          {roster.rows.map((row) => (
            <tr key={row.student.id} className="border-b border-rule align-middle">
              <td className="py-3 pr-4">
                <p className="flex items-center gap-2 text-base font-bold text-ink">
                  {row.student.name}
                  {row.completedAt ? <Tick className="h-4 w-5" title="Completed" /> : null}
                </p>
                <p className="text-sm text-muted">{row.student.email}</p>
              </td>
              <td className="py-3 pr-4">
                <InkProgress percent={row.summary.progress.percent} label={`${row.student.name} progress`} />
                <p className="figures mt-1 text-xs text-muted">
                  {row.summary.progress.completedLessons}/{row.summary.progress.totalLessons} lessons, {row.summary.progress.passedAssessments}/{row.summary.progress.totalAssessments} passed
                </p>
              </td>
              <td className="figures py-3 pr-4 text-base text-ink-soft">{formatDate(row.enrolledAt)}</td>
              <td className="py-3 text-base text-ink-soft">{row.lastActive ? formatRelative(row.lastActive) : "Not started"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
