import type { Metadata } from "next";
import { AssessmentForm } from "@/components/forms/assessment-form";
import { Section } from "@/components/ui/layout";
import { createAssessmentAction } from "@/server/actions/teaching";
import { requireRole } from "@/server/auth/session";

export const metadata: Metadata = { title: "New quiz or assignment" };

export default async function NewAssessmentPage(props: PageProps<"/teach/courses/[courseId]/assessments/new">) {
  await requireRole("TEACHER");
  const [{ courseId }, { kind }] = await Promise.all([props.params, props.searchParams]);
  const defaultKind = kind === "ASSIGNMENT" ? "ASSIGNMENT" : "QUIZ";
  return (
    <Section
      title={defaultKind === "QUIZ" ? "New quiz" : "New assignment"}
      description={defaultKind === "QUIZ" ? "Set it up here, then add questions on the next screen. It stays hidden until you publish it." : "Write the task in the instructions. It stays hidden until you publish it."}
    >
      <AssessmentForm action={createAssessmentAction.bind(null, courseId)} defaultKind={defaultKind} submitLabel={defaultKind === "QUIZ" ? "Create quiz" : "Create assignment"} />
    </Section>
  );
}
