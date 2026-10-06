import { ResendConfirmationForm } from "@/components/forms/account-forms";

/** Shown on every signed-in page until the account's email address is confirmed. */
export function ConfirmEmailBanner({ email }: { email: string }) {
  return (
    <div className="mb-8 flex flex-col gap-4 border border-amber/30 bg-amber-wash px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
      <p className="max-w-[60ch] text-base text-amber">
        <span className="font-bold">Confirm your email address.</span> We sent a link to <span className="font-bold break-all">{email}</span>. You&rsquo;ll
        need it before you can choose a teacher, book sessions or send messages.
      </p>
      <ResendConfirmationForm className="shrink-0" />
    </div>
  );
}
