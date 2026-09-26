import Link from "next/link";
import { Wordmark } from "@/components/brand/wordmark";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-8">
        <Wordmark />
        <Link href="/courses" className="text-base font-bold text-ink-soft hover:text-ink">
          Browse courses
        </Link>
      </header>
      <main id="main" className="mx-auto max-w-6xl px-4 pt-8 pb-20 sm:px-8 sm:pt-14">
        {children}
      </main>
    </div>
  );
}
