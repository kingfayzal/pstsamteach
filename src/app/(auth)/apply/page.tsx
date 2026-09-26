import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ApplyForm } from "@/components/forms/auth-forms";
import { homePathFor } from "@/lib/routes";
import { getCurrentUser } from "@/server/auth/session";
import { listActiveSubjects } from "@/server/queries/catalog";

export const metadata: Metadata = { title: "Apply to teach" };

export default async function ApplyPage() {
  const user = await getCurrentUser();
  if (user) redirect(homePathFor(user));
  const subjects = await listActiveSubjects();

  return (
    <div className="grid grid-cols-1 gap-16 lg:grid-cols-[32rem_1fr]">
      <div>
        <h1 className="text-4xl text-ink">Apply to teach</h1>
        <p className="mt-2 mb-8 text-lg text-ink-soft">
          You can sign in straight away. You&rsquo;ll be able to build courses once an admin approves your application.
        </p>
        <ApplyForm subjects={subjects.map((s) => ({ id: s.id, name: s.name }))} />
      </div>
      <aside className="hidden self-start border-l-2 border-margin pl-8 lg:block">
        <p className="text-lg font-bold text-ink">What we look for</p>
        <ul className="mt-3 max-w-[42ch] list-disc space-y-2 pl-5 text-base text-ink-soft">
          <li>Experience teaching the subject, in a classroom or one to one.</li>
          <li>For Nursing: current or past registration, or clinical teaching experience.</li>
          <li>Willingness to mark written work and leave useful feedback.</li>
        </ul>
      </aside>
    </div>
  );
}
