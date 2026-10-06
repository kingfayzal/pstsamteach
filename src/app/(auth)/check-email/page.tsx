import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChangeEmailForm, ResendConfirmationForm } from "@/components/forms/account-forms";
import { Notice } from "@/components/ui/notice";
import { homePathFor } from "@/lib/routes";
import { logoutAction } from "@/server/actions/auth";
import { needsEmailConfirmation, requireUser } from "@/server/auth/session";

export const metadata: Metadata = { title: "Confirm your email" };

const linkClass = "font-bold text-ink underline decoration-rule underline-offset-4 hover:decoration-ink";

/**
 * Where every account waits until its email address is confirmed (requireUser
 * sends it here). It can ask for a new link, fix a mistyped address or log out,
 * and nothing else.
 */
export default async function CheckEmailPage(props: PageProps<"/check-email">) {
  const user = await requireUser({ allowUnconfirmed: true });
  if (!(await needsEmailConfirmation())) redirect(homePathFor(user));
  const { notice } = await props.searchParams;
  const next = user.role === "TEACHER" && user.status === "PENDING" ? "Then you can follow your application." : "Then you can start using your account.";

  return (
    <div className="max-w-md">
      <Notice value={notice} />
      <h1 className="text-4xl text-ink">Confirm your email address</h1>
      <p className="mt-2 text-lg text-ink-soft">
        We sent a link to <span className="font-bold break-all text-ink">{user.email}</span>. Open it to confirm this address. {next}
      </p>
      <p className="mt-3 text-base text-ink-soft">
        It can take a minute to arrive. If it doesn&rsquo;t, check your spam folder or send a new one.
      </p>

      <div className="mt-8 space-y-8">
        <ResendConfirmationForm />

        <details className="group border-t border-rule pt-6">
          <summary className="cursor-pointer text-base font-bold text-ink">Wrong address?</summary>
          <div className="mt-4">
            <ChangeEmailForm />
          </div>
        </details>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-rule pt-6 text-base text-ink-soft">
          <span>
            Confirmed it in another tab?{" "}
            <Link href={homePathFor(user)} className={linkClass}>
              Carry on
            </Link>
          </span>
          <form action={logoutAction}>
            <button type="submit" className={linkClass}>
              Log out
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
