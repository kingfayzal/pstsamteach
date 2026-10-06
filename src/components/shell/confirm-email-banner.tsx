import Link from "next/link";
import { ResendConfirmationForm } from "@/components/forms/account-forms";
import { CHECK_EMAIL_PATH } from "@/lib/routes";

/**
 * On public pages, for someone signed in whose address isn't confirmed yet.
 * Everything that needs an account waits for it (see requireUser).
 */
export function ConfirmEmailBanner({ email }: { email: string }) {
  return (
    <div className="mb-8 flex flex-col gap-4 border border-amber/30 bg-amber-wash px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
      <p className="max-w-[60ch] text-base text-amber">
        <span className="font-bold">Confirm your email address to start using your account.</span> We sent a link to{" "}
        <span className="font-bold break-all">{email}</span>.{" "}
        <Link href={CHECK_EMAIL_PATH} className="font-bold underline underline-offset-4">
          Wrong address?
        </Link>
      </p>
      <ResendConfirmationForm className="shrink-0" />
    </div>
  );
}
