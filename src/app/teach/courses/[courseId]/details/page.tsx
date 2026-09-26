import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CourseForm } from "@/components/forms/course-form";
import { canTeacherEditContent } from "@/lib/course-lifecycle";
import { updateCourseAction } from "@/server/actions/teaching";
import { requireRole } from "@/server/auth/session";
import { listActiveSubjects } from "@/server/queries/catalog";
import { getCourseForEditor } from "@/server/queries/teacher";

export const metadata: Metadata = { title: "Course details" };

export default async function CourseDetailsPage(props: PageProps<"/teach/courses/[courseId]/details">) {
  const user = await requireRole("TEACHER");
  const { courseId } = await props.params;
  const [data, subjects] = await Promise.all([getCourseForEditor(user, courseId), listActiveSubjects()]);
  if (!data) notFound();
  const { course } = data;

  return (
    <CourseForm
      action={updateCourseAction.bind(null, course.id)}
      subjects={subjects.map((s) => ({ id: s.id, name: s.name }))}
      course={{ title: course.title, summary: course.summary, description: course.description, subjectId: course.subjectId, level: course.level }}
      submitLabel="Save details"
      disabled={!canTeacherEditContent(course.status)}
    />
  );
}
