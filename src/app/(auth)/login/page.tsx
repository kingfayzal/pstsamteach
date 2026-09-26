import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/forms/auth-forms";
import { homePathFor, safeNextPath } from "@/lib/routes";
import { getCurrentUser } from "@/server/auth/session";

export const metadata: Metadata = { title: "Log in" };

export default async function LoginPage(props: PageProps<"/login">) {
  const user = await getCurrentUser();
  if (user) redirect(homePathFor(user));
  const { next } = await props.searchParams;
  const safeNext = safeNextPath(Array.isArray(next) ? next[0] : next) ?? undefined;

  return (
    <div className="max-w-md">
      <h1 className="text-4xl text-ink">Log in</h1>
      <p className="mt-2 mb-8 text-lg text-ink-soft">Pick up where you left off.</p>
      <LoginForm next={safeNext} />
    </div>
  );
}
