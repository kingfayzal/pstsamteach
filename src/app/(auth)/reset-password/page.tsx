import type { Metadata } from "next";
import { ResetPasswordForm } from "@/components/forms/auth-forms";
import { LinkButton } from "@/components/ui/button";
import { checkPasswordResetLink } from "@/server/services/password-reset";

export const metadata: Metadata = { title: "Choose a new password" };

export default async function ResetPasswordPage(props: PageProps<"/reset-password">) {
  const { token } = await props.searchParams;
  const value = Array.isArray(token) ? token[0] : token;
  const link = value ? await checkPasswordResetLink(value) : null;

  if (!value || !link) {
    return (
      <div className="max-w-md">
        <h1 className="text-4xl text-ink">This link doesn&rsquo;t work any more</h1>
        <p className="mt-2 mb-8 text-lg text-ink-soft">Reset links work for one hour, and only once. Ask for a new one and use the latest email.</p>
        <LinkButton href="/forgot-password">Ask for a new link</LinkButton>
      </div>
    );
  }

  return (
    <div className="max-w-md">
      <h1 className="text-4xl text-ink">Choose a new password</h1>
      <p className="mt-2 mb-8 text-lg text-ink-soft">
        For {link.name}&rsquo;s account. Saving it signs you in here and signs out every other device.
      </p>
      <ResetPasswordForm token={value} />
    </div>
  );
}
