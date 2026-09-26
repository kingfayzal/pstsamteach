import type { Metadata } from "next";
import Link from "next/link";
import { PhotoForm } from "@/components/forms/photo-form";
import { TeacherProfileForm } from "@/components/forms/teacher-profile-form";
import { TeacherAvatar } from "@/components/teachers/teacher-avatar";
import { LinkButton } from "@/components/ui/button";
import { PageHeader, Section } from "@/components/ui/layout";
import { Tick } from "@/components/ui/marks";
import { listTimeZones } from "@/lib/time-zones";
import { removePhotoAction, updateTeacherProfileAction, uploadPhotoAction } from "@/server/actions/teacher-profile";
import { requireRole } from "@/server/auth/session";
import { getProfileEditor, listSubjectsWithTopics } from "@/server/queries/teachers";
import { ensureTeacherProfile } from "@/server/services/teacher-profiles";

export const metadata: Metadata = { title: "Your teacher profile" };

export default async function TeacherProfilePage() {
  const user = await requireRole("TEACHER", { allowPending: true });
  await ensureTeacherProfile(user);
  const [editor, subjects] = await Promise.all([getProfileEditor(user.id), listSubjectsWithTopics()]);
  if (!editor) throw new Error("Teacher profile could not be created.");
  const { profile, gaps, isListed } = editor;

  return (
    <>
      <PageHeader
        title="Your teacher profile"
        description="This is what students read when they choose a teacher. The more they know about you, the easier the choice."
        actions={
          <LinkButton href={`/teachers/${profile.slug}`} variant="secondary">
            Preview
          </LinkButton>
        }
      />

      <div className="mb-10 space-y-3 border border-rule bg-sheet px-5 py-4">
        {isListed ? (
          <p className="flex items-center gap-2 text-base font-bold text-tick-text">
            <Tick className="h-5 w-6" /> Listed in the directory. Students can find and choose you.
          </p>
        ) : (
          <>
            <p className="text-base font-bold text-ink">Not in the directory yet</p>
            <ul className="list-disc space-y-1 pl-5 text-base text-ink-soft">
              {user.status === "PENDING" ? <li>Wait for an admin to approve your teacher application.</li> : null}
              {profile.isHidden ? <li>An admin has hidden your profile. Contact the platform team.</li> : null}
              {gaps.map((gap) => (
                <li key={gap}>{gap}</li>
              ))}
            </ul>
          </>
        )}
        <p className="text-sm text-muted">
          {profile.availability.length ? `${profile.availability.length} weekly time range${profile.availability.length === 1 ? "" : "s"} set. ` : "No weekly availability yet. "}
          <Link href="/teach/profile/availability" className="font-bold text-ink underline decoration-rule underline-offset-4">
            Set your availability
          </Link>
        </p>
      </div>

      <div className="space-y-14">
        <Section title="Photo">
          <div className="flex flex-wrap items-start gap-6">
            <TeacherAvatar name={user.name} photo={profile.photoUrl} color={profile.topics[0]?.topic.subject.color} size="lg" />
            <PhotoForm upload={uploadPhotoAction} remove={removePhotoAction} hasPhoto={Boolean(profile.photoUrl)} />
          </div>
        </Section>
        <TeacherProfileForm action={updateTeacherProfileAction} profile={profile} subjects={subjects} timeZones={listTimeZones()} />
      </div>
    </>
  );
}
