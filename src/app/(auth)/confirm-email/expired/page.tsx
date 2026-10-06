import type { Metadata } from "next";
import { ResendConfirmationForm } from "@/components/forms/account-forms";
import { LinkButton } from "@/components/ui/button";
import { homePathFor } from "@/lib/routes";
import { getCurrentUser } from "@/server/auth/session";
import { getUnconfirmedEmail } from "@/server/queries/account";

export const metadata: Metadata = { title: "Confirm your email" };

export default async function ConfirmEmailExpiredPage() {
  const user = await getCurrentUser();
  const unconfirmed = user ? await getUnconfirmedEmail(user.id) : null;

  return (
    <div className="max-w-md">
      <h1 className="text-4xl text-ink">This link doesn&rsquo;t work any more</h1>
      {!user ? (
        <>
          <p className="mt-2 mb-8 text-lg text-ink-soft">
            Confirmation links work for 3 days. Log in and we&rsquo;ll offer to send you a new one.
          </p>
          <LinkButton href="/login">Log in</LinkButton>
        </>
      ) : unconfirmed ? (
        <>
          <p className="mt-2 mb-8 text-lg text-ink-soft">
            Confirmation links work for 3 days. Send a new one to <span className="font-bold break-all text-ink">{unconfirmed}</span> and use the latest email.
          </p>
          <ResendConfirmationForm />
        </>
      ) : (
        <>
          <p className="mt-2 mb-8 text-lg text-ink-soft">Your email address is already confirmed, so there&rsquo;s nothing else to do.</p>
          <LinkButton href={homePathFor(user)}>Go to your dashboard</LinkButton>
        </>
      )}
    </div>
  );
}
