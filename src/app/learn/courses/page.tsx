import type { Metadata } from "next";
import { EnrolledCourseRow } from "@/components/course/enrolled-course-row";
import { LinkButton } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/ui/layout";
import { requireRole } from "@/server/auth/session";
import { getStudentCourses } from "@/server/queries/student";

export const metadata: Metadata = { title: "My courses" };

export default async function MyCoursesPage() {
  const user = await requireRole("STUDENT");
  const courses = await getStudentCourses(user.id);

  return (
    <>
      <PageHeader title="My courses" description="Everything you're enrolled in, newest first." actions={<LinkButton href="/courses" variant="secondary">Find another course</LinkButton>} />
      {courses.length === 0 ? (
        <EmptyState title="You haven't enrolled in a course yet" action={<LinkButton href="/courses">Browse courses</LinkButton>} />
      ) : (
        <ul className="border-t border-rule">
          {courses.map((c) => (
            <EnrolledCourseRow key={c.course.id} course={c.course} summary={c.summary} completedAt={c.completedAt} />
          ))}
        </ul>
      )}
    </>
  );
}
