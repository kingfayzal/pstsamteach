import type { Metadata } from "next";
import { PasswordForm, ProfileForm } from "@/components/forms/account-forms";
import { AppShell } from "@/components/shell/app-shell";
import { PageHeader, Section } from "@/components/ui/layout";
import { AREA_LABEL, navFor } from "@/lib/nav";
import { homePathFor } from "@/lib/routes";
import { requireUser } from "@/server/auth/session";
import { getProfile } from "@/server/queries/account";

export const metadata: Metadata = { title: "Account" };

export default async function AccountPage() {
  const user = await requireUser();
  const profile = await getProfile(user.id);
  const nav = user.status === "PENDING" ? [{ href: "/teach/pending", label: "Your application" }] : navFor(user.role);

  return (
    <AppShell area={AREA_LABEL[user.role]} home={homePathFor(user)} nav={nav} user={user}>
      <PageHeader title="Account" description={`Signed in as ${user.email}.`} />
      <div className="space-y-14">
        <Section title="Profile">
          <ProfileForm name={profile.name} bio={profile.bio} showBio={user.role === "TEACHER"} />
        </Section>
        <Section title="Password" description="Changing it signs you out on every other device.">
          <PasswordForm />
        </Section>
      </div>
    </AppShell>
  );
}
