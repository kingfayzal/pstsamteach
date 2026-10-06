import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/forms/auth-forms";

export const metadata: Metadata = { title: "Reset your password" };

export default function ForgotPasswordPage() {
  return (
    <div className="max-w-md">
      <h1 className="text-4xl text-ink">Reset your password</h1>
      <p className="mt-2 mb-8 text-lg text-ink-soft">Enter the email address you signed up with, and we&rsquo;ll send you a link to choose a new password.</p>
      <ForgotPasswordForm />
    </div>
  );
}
