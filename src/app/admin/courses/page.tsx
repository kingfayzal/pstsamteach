import type { Metadata } from "next";
import Link from "next/link";
import { FilterBar } from "@/components/admin/filter-bar";
import { CourseStatusBadge, SubjectTag } from "@/components/ui/badges";
import { EmptyState, PageHeader } from "@/components/ui/layout";
import { STATUS_LABEL } from "@/lib/course-lifecycle";
import { formatRelative } from "@/lib/format";
import { requireRole } from "@/server/auth/session";
import { listAllCourses } from "@/server/queries/admin";

export const metadata: Metadata = { title: "All courses" };

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function AdminCoursesPage(props: PageProps<"/admin/courses">) {
  await requireRole("ADMIN");
  const sp = await props.searchParams;
  const filters = { q: one(sp.q), status: one(sp.status) };
  const courses = await listAllCourses(filters);

  return (
    <>
      <PageHeader title="Courses" description="Every course on the platform, in any state." />
      <FilterBar
        action="/admin/courses"
        q={filters.q}
        placeholder="Course title or teacher"
        selects={[{ name: "status", label: "Status", value: filters.status, options: Object.entries(STATUS_LABEL).map(([value, label]) => ({ value, label })) }]}
      />
      {courses.length === 0 ? (
        <EmptyState title="No courses match" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[46rem] border-collapse text-left">
            <thead>
              <tr className="border-b-2 border-ink text-sm text-ink-soft">
                <th scope="col" className="py-2 pr-4 font-bold">Course</th>
                <th scope="col" className="py-2 pr-4 font-bold">Teacher</th>
                <th scope="col" className="py-2 pr-4 font-bold">Status</th>
                <th scope="col" className="py-2 pr-4 text-right font-bold">Students</th>
                <th scope="col" className="py-2 font-bold">Updated</th>
              </tr>
            </thead>
            <tbody>
              {courses.map((c) => (
                <tr key={c.id} className="border-b border-rule">
                  <td className="py-3 pr-4">
                    <Link href={`/admin/courses/${c.id}`} className="text-base font-bold text-ink underline decoration-rule underline-offset-4 hover:decoration-ink">
                      {c.title}
                    </Link>
                    <div className="flex items-center gap-3">
                      <SubjectTag name={c.subject.name} color={c.subject.color} />
                      {c.isFeatured ? <span className="text-sm text-muted">Featured</span> : null}
                    </div>
                  </td>
                  <td className="py-3 pr-4 text-base text-ink-soft">{c.teacher.name}</td>
                  <td className="py-3 pr-4">
                    <CourseStatusBadge status={c.status} />
                  </td>
                  <td className="figures py-3 pr-4 text-right text-base text-ink-soft">{c._count.enrollments}</td>
                  <td className="py-3 text-sm text-muted">{formatRelative(c.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
