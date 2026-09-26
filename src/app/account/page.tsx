import type { Metadata } from "next";
import { PasswordForm, ProfileForm, TimeZoneForm } from "@/components/forms/account-forms";
import { AppShell } from "@/components/shell/app-shell";
import { PageHeader, Section } from "@/components/ui/layout";
import { AREA_LABEL, navFor, PENDING_TEACHER_NAV } from "@/lib/nav";
import { homePathFor } from "@/lib/routes";
import { listTimeZones } from "@/lib/time-zones";
import { requireUser } from "@/server/auth/session";
import { getViewerTimeZone } from "@/server/auth/viewer";
import { getProfile } from "@/server/queries/account";

export const metadata: Metadata = { title: "Account" };

export default async function AccountPage() {
  const user = await requireUser();
  const [profile, suggested] = await Promise.all([getProfile(user.id), getViewerTimeZone()]);
  const nav = user.status === "PENDING" ? [...PENDING_TEACHER_NAV] : navFor(user.role);

  return (
    <AppShell area={AREA_LABEL[user.role]} home={homePathFor(user)} nav={nav} user={user}>
      <PageHeader title="Account" description={`Signed in as ${user.email}.`} />
      <div className="space-y-14">
        <Section title="Profile">
          <ProfileForm name={profile.name} bio={profile.bio} showBio={user.role === "TEACHER"} />
        </Section>
        <Section title="Time zone" description="Session times, availability and deadlines are shown in this zone.">
          <TimeZoneForm current={profile.timeZone} suggested={suggested} zones={listTimeZones()} />
        </Section>
        <Section title="Password" description="Changing it signs you out on every other device.">
          <PasswordForm />
        </Section>
      </div>
    </AppShell>
  );
}
