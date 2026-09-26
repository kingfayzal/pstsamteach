import Link from "next/link";
import { homePathFor } from "@/lib/routes";
import { SITE } from "@/lib/site";
import type { Actor } from "@/server/services/result";
import { Wordmark } from "@/components/brand/wordmark";
import { LinkButton } from "@/components/ui/button";

export function PublicHeader({ user }: { user: Actor | null }) {
  return (
    <header className="border-b border-rule">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-3 px-4 py-4 sm:px-8">
        <Wordmark />
        <nav aria-label="Main" className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <Link href="/courses" className="text-base font-bold text-ink-soft hover:text-ink">
            Courses
          </Link>
          <Link href="/teach-with-us" className="text-base font-bold text-ink-soft hover:text-ink">
            Teach with us
          </Link>
          {user ? (
            <LinkButton href={homePathFor(user)} size="sm">
              Go to your dashboard
            </LinkButton>
          ) : (
            <>
              <Link href="/login" className="text-base font-bold text-ink-soft hover:text-ink">
                Log in
              </Link>
              <LinkButton href="/signup" size="sm">
                Join free
              </LinkButton>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer className="mt-24 border-t border-rule">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 text-base text-ink-soft sm:grid-cols-3 sm:px-8">
        <div className="space-y-2">
          <Wordmark />
          <p className="max-w-[36ch] text-sm text-muted">{SITE.description}</p>
        </div>
        <nav aria-label="Learners" className="space-y-2 text-sm">
          <p className="font-bold text-ink">Learners</p>
          <Link href="/courses" className="block hover:text-ink">Browse courses</Link>
          <Link href="/signup" className="block hover:text-ink">Create a student account</Link>
          <Link href="/login" className="block hover:text-ink">Log in</Link>
        </nav>
        <nav aria-label="Teachers" className="space-y-2 text-sm">
          <p className="font-bold text-ink">Teachers</p>
          <Link href="/teach-with-us" className="block hover:text-ink">How teaching works</Link>
          <Link href="/apply" className="block hover:text-ink">Apply to teach</Link>
          <a href={`mailto:${SITE.supportEmail}`} className="block hover:text-ink">Contact the team</a>
        </nav>
      </div>
    </footer>
  );
}
