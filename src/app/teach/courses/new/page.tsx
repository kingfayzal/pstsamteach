import type { Metadata } from "next";
import { CourseForm } from "@/components/forms/course-form";
import { PageHeader } from "@/components/ui/layout";
import { createCourseAction } from "@/server/actions/teaching";
import { requireRole } from "@/server/auth/session";
import { listActiveSubjects } from "@/server/queries/catalog";

export const metadata: Metadata = { title: "New course" };

export default async function NewCoursePage() {
  await requireRole("TEACHER");
  const subjects = await listActiveSubjects();
  return (
    <>
      <PageHeader
        crumbs={[{ href: "/teach/courses", label: "Courses" }]}
        title="New course"
        description="Start with the basics. It's saved as a draft, so nothing is public until an admin approves it."
      />
      <CourseForm action={createCourseAction} subjects={subjects.map((s) => ({ id: s.id, name: s.name }))} submitLabel="Create draft" />
    </>
  );
}
