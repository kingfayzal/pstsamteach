import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SignupForm } from "@/components/forms/auth-forms";
import { homePathFor, safeNextPath } from "@/lib/routes";
import { getCurrentUser } from "@/server/auth/session";

export const metadata: Metadata = { title: "Create a student account" };

export default async function SignupPage(props: PageProps<"/signup">) {
  const user = await getCurrentUser();
  if (user) redirect(homePathFor(user));
  const { next } = await props.searchParams;
  const safeNext = safeNextPath(Array.isArray(next) ? next[0] : next) ?? undefined;

  return (
    <div className="grid gap-16 lg:grid-cols-[28rem_1fr]">
      <div>
        <h1 className="text-4xl text-ink">Create a student account</h1>
        <p className="mt-2 mb-8 text-lg text-ink-soft">Free to join. Enrol in as many courses as you like.</p>
        <SignupForm next={safeNext} />
      </div>
      <aside className="hidden self-start border-l-2 border-margin pl-8 lg:block">
        <p className="text-lg font-bold text-ink">Want to teach instead?</p>
        <p className="mt-2 max-w-[40ch] text-base text-ink-soft">
          Teacher accounts are approved by our team, so there&rsquo;s a separate application.
        </p>
        <Link href="/apply" className="mt-3 inline-block text-base font-bold text-ink underline decoration-rule underline-offset-4 hover:decoration-ink">
          Apply to teach
        </Link>
      </aside>
    </div>
  );
}
