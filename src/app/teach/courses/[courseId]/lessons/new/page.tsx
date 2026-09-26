import type { Metadata } from "next";
import { LessonForm } from "@/components/forms/lesson-form";
import { Section } from "@/components/ui/layout";
import { createLessonAction } from "@/server/actions/teaching";
import { requireRole } from "@/server/auth/session";

export const metadata: Metadata = { title: "New lesson" };

export default async function NewLessonPage(props: PageProps<"/teach/courses/[courseId]/lessons/new">) {
  await requireRole("TEACHER");
  const { courseId } = await props.params;
  return (
    <Section title="New lesson" description="It's added to the end of the course. You can reorder lessons afterwards.">
      <LessonForm action={createLessonAction.bind(null, courseId)} submitLabel="Add lesson" />
    </Section>
  );
}
