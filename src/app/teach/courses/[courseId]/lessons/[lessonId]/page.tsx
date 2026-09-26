import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Markdown } from "@/components/course/markdown";
import { LessonForm } from "@/components/forms/lesson-form";
import { ActionButton } from "@/components/ui/action-button";
import { Section } from "@/components/ui/layout";
import { canTeacherEditContent } from "@/lib/course-lifecycle";
import { deleteLessonAction, updateLessonAction } from "@/server/actions/teaching";
import { requireRole } from "@/server/auth/session";
import { getLessonForEditor } from "@/server/queries/teacher";

export const metadata: Metadata = { title: "Edit lesson" };

export default async function EditLessonPage(props: PageProps<"/teach/courses/[courseId]/lessons/[lessonId]">) {
  const user = await requireRole("TEACHER");
  const { courseId, lessonId } = await props.params;
  const lesson = await getLessonForEditor(user, courseId, lessonId);
  if (!lesson) notFound();
  const editable = canTeacherEditContent(lesson.course.status);

  if (!editable) {
    return (
      <Section title={lesson.title} description="Editing is locked while the course is in review or archived. This is what students see.">
        <Markdown>{lesson.body}</Markdown>
      </Section>
    );
  }

  return (
    <div className="space-y-12">
      <Section
        title="Edit lesson"
        actions={
          <Link href={`/teach/courses/${courseId}`} className="text-base font-bold underline decoration-rule underline-offset-4">
            Back to all lessons
          </Link>
        }
      >
        <LessonForm action={updateLessonAction.bind(null, courseId, lesson.id)} lesson={lesson} submitLabel="Save lesson" />
      </Section>
      <div className="border-t border-rule pt-6">
        <ActionButton
          action={deleteLessonAction.bind(null, courseId, lesson.id)}
          label="Delete this lesson"
          pendingLabel="Deleting…"
          variant="danger"
          confirm="Delete this lesson? Students' progress on it will be removed too. This can't be undone."
        />
      </div>
    </div>
  );
}
