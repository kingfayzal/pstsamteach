import type { Metadata } from "next";
import { TeacherCourseList } from "@/components/course/teacher-course-list";
import { LinkButton } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/ui/layout";
import { requireRole } from "@/server/auth/session";
import { getTeacherCourses } from "@/server/queries/teacher";

export const metadata: Metadata = { title: "Your courses" };

export default async function TeacherCoursesPage() {
  const user = await requireRole("TEACHER");
  const courses = await getTeacherCourses(user);
  return (
    <>
      <PageHeader title="Your courses" description="Drafts, courses in review, and everything you've published." actions={<LinkButton href="/teach/courses/new">New course</LinkButton>} />
      {courses.length === 0 ? (
        <EmptyState title="No courses yet" action={<LinkButton href="/teach/courses/new">Create your first course</LinkButton>} />
      ) : (
        <TeacherCourseList courses={courses} />
      )}
    </>
  );
}
