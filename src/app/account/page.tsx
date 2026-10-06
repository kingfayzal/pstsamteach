import type { Metadata } from "next";
import { PasswordForm, ProfileForm, TimeZoneForm } from "@/components/forms/account-forms";
import { AppShell } from "@/components/shell/app-shell";
import { PageHeader, Section } from "@/components/ui/layout";
import { Tick } from "@/components/ui/marks";
import { Notice } from "@/components/ui/notice";
import { AREA_LABEL, navFor, PENDING_TEACHER_NAV } from "@/lib/nav";
import { homePathFor } from "@/lib/routes";
import { listTimeZones } from "@/lib/time-zones";
import { requireUser } from "@/server/auth/session";
import { getViewerTimeZone } from "@/server/auth/viewer";
import { getProfile } from "@/server/queries/account";

export const metadata: Metadata = { title: "Account" };

export default async function AccountPage(props: PageProps<"/account">) {
  const user = await requireUser();
  const [profile, suggested, { notice }] = await Promise.all([getProfile(user.id), getViewerTimeZone(), props.searchParams]);
  const nav = user.status === "PENDING" ? [...PENDING_TEACHER_NAV] : navFor(user.role);

  return (
    <AppShell area={AREA_LABEL[user.role]} home={homePathFor(user)} nav={nav} user={user}>
      <Notice value={notice} />
      <PageHeader title="Account" description={`Signed in as ${user.email}.`} />
      <div className="space-y-14">
        <Section title="Email address" description="Where we send session details, reminders and account messages.">
          {/* Only confirmed accounts get this far (requireUser holds the rest at /check-email). */}
          <p className="flex items-center gap-2 text-lg text-ink">
            <span className="font-bold break-all">{profile.email}</span>
            <span className="inline-flex items-center gap-1 text-base font-bold text-tick-text">
              <Tick className="h-4 w-4" />
              Confirmed
            </span>
          </p>
        </Section>
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
