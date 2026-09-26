import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import type { CSSProperties } from "react";
import { ChooseTeacherForm } from "@/components/forms/choose-teacher-form";
import { TeacherAvatar } from "@/components/teachers/teacher-avatar";
import { LinkButton } from "@/components/ui/button";
import { Breadcrumbs } from "@/components/ui/layout";
import { requestTeacherAction } from "@/server/actions/find-teacher";
import { getCurrentUser } from "@/server/auth/session";
import { getViewerTimeZone } from "@/server/auth/viewer";
import { labelSlotGroups } from "@/server/queries/slot-labels";
import { getBookingSlots, getTeacherProfilePage } from "@/server/queries/teachers";

export const metadata: Metadata = { title: "Choose your teacher" };

export default async function ChooseTeacherPage(props: PageProps<"/teachers/[slug]/choose">) {
  const [{ slug }, user, timeZone] = await Promise.all([props.params, getCurrentUser(), getViewerTimeZone()]);
  const data = await getTeacherProfilePage(slug, { id: user?.id, role: user?.role, timeZone });
  if (!data || !data.isListed) notFound();
  const { profile, viewerRelation } = data;
  const firstName = profile.name.split(" ")[0];
  const color = profile.subjects[0]?.color;
  const back = `/teachers/${profile.slug}`;

  const connection = viewerRelation.connection;
  if (connection && (connection.status === "PENDING" || connection.status === "ACTIVE")) redirect(`/learn/teachers/${connection.id}`);

  let body: React.ReactNode;
  if (!user) {
    body = (
      <div className="max-w-xl space-y-4">
        <p className="text-lg text-ink-soft">Create a free student account to ask {firstName} to be your teacher. It takes a minute.</p>
        <div className="flex flex-wrap gap-3">
          <LinkButton href={`/signup?next=${encodeURIComponent(`${back}/choose`)}`}>Create a student account</LinkButton>
          <LinkButton href={`/login?next=${encodeURIComponent(`${back}/choose`)}`} variant="secondary">
            Log in
          </LinkButton>
        </div>
      </div>
    );
  } else if (user.role !== "STUDENT") {
    body = <p className="max-w-xl text-lg text-ink-soft">Only student accounts can choose a teacher.</p>;
  } else if (!profile.acceptingStudents) {
    body = <p className="max-w-xl text-lg text-ink-soft">{firstName} isn&rsquo;t taking new students right now. Save them to your shortlist and check back soon.</p>;
  } else {
    const slots = labelSlotGroups(await getBookingSlots(profile.teacherId, user.id, timeZone), timeZone);
    const topics = profile.subjects.flatMap((s) => s.topics.map((t) => ({ id: t.id, label: profile.subjects.length > 1 ? `${s.name}: ${t.name}` : t.name })));
    body = (
      <ChooseTeacherForm action={requestTeacherAction.bind(null, profile.teacherId)} firstName={firstName} topics={topics} slots={slots} timeZone={timeZone} />
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 pt-10 sm:px-8" style={{ "--subject": color } as CSSProperties}>
      <Breadcrumbs items={[{ href: "/teachers", label: "Teachers" }, { href: back, label: profile.name }]} />
      <header className="mb-10 flex items-center gap-5 border-b border-rule pb-8">
        <TeacherAvatar name={profile.name} photo={profile.photo} color={color} size="md" />
        <div>
          <h1 className="text-3xl text-ink">Ask {firstName} to be your teacher</h1>
          <p className="text-lg text-ink-soft">{profile.headline}</p>
        </div>
      </header>
      {body}
    </div>
  );
}
