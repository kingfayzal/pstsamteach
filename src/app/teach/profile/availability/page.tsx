import type { Metadata } from "next";
import { AvailabilityEditor } from "@/components/forms/availability-editor";
import { PageHeader } from "@/components/ui/layout";
import { saveAvailabilityAction } from "@/server/actions/teacher-profile";
import { requireRole } from "@/server/auth/session";
import { getProfileEditor } from "@/server/queries/teachers";
import { ensureTeacherProfile } from "@/server/services/teacher-profiles";

export const metadata: Metadata = { title: "Your availability" };

export default async function AvailabilityPage() {
  const user = await requireRole("TEACHER", { allowPending: true });
  await ensureTeacherProfile(user);
  const editor = await getProfileEditor(user.id);
  if (!editor) throw new Error("Teacher profile could not be created.");

  return (
    <>
      <PageHeader
        crumbs={[{ href: "/teach/profile", label: "Your teacher profile" }]}
        title="When you teach"
        description="Your regular weekly times. Students book sessions inside these times, at least 12 hours ahead, up to two weeks out."
      />
      <AvailabilityEditor action={saveAvailabilityAction} initial={editor.profile.availability} timeZone={editor.profile.timeZone} />
    </>
  );
}
