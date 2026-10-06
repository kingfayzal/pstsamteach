import Link from "next/link";
import type { ReactNode } from "react";
import { logoutAction } from "@/server/actions/auth";
import { Wordmark } from "@/components/brand/wordmark";
import { NavLinks, type NavItem } from "./nav-links";

type Props = {
  area: string;
  home: string;
  nav: NavItem[];
  user: { name: string; email: string };
  children: ReactNode;
};

function SignOut() {
  return (
    <form action={logoutAction}>
      <button type="submit" className="text-sm font-bold text-ink-soft underline decoration-rule underline-offset-4 hover:text-ink hover:decoration-ink">
        Log out
      </button>
    </form>
  );
}

function UserBlock({ user }: { user: Props["user"] }) {
  return (
    <div className="space-y-2 border-t border-rule pt-4">
      <p className="truncate text-base font-bold text-ink">{user.name}</p>
      <p className="truncate text-sm text-muted">{user.email}</p>
      <div className="flex items-center gap-4 pt-1">
        <Link href="/account" className="text-sm font-bold text-ink-soft underline decoration-rule underline-offset-4 hover:text-ink hover:decoration-ink">
          Account
        </Link>
        <SignOut />
      </div>
    </div>
  );
}

/** Shell for the signed-in areas: a rail on wide screens, a disclosure menu on phones. */
export function AppShell({ area, home, nav, user, children }: Props) {
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[16rem_minmax(0,1fr)]">
      <aside className="hidden border-r border-rule lg:block">
        <div className="sticky top-0 flex h-dvh flex-col gap-8 px-4 py-6">
          <div className="space-y-1 px-3">
            <Wordmark href={home} />
            <p className="text-sm text-muted">{area}</p>
          </div>
          <nav aria-label={`${area} navigation`} className="flex-1">
            <NavLinks items={nav} />
          </nav>
          <div className="px-3">
            <UserBlock user={user} />
          </div>
        </div>
      </aside>

      <header className="border-b border-rule px-4 py-3 lg:hidden">
        <details className="group">
          <summary className="flex cursor-pointer list-none items-center justify-between [&::-webkit-details-marker]:hidden">
            <span className="flex items-center gap-3">
              <Wordmark href={home} />
              <span className="text-sm text-muted">{area}</span>
            </span>
            <span className="rounded-control border border-rule bg-sheet px-3 py-1.5 text-sm font-bold">
              <span className="group-open:hidden">Menu</span>
              <span className="hidden group-open:inline">Close</span>
            </span>
          </summary>
          <nav aria-label={`${area} navigation`} className="mt-4 space-y-4 pb-2">
            <NavLinks items={nav} />
            <UserBlock user={user} />
          </nav>
        </details>
      </header>

      <main id="main" className="min-w-0 px-4 py-8 sm:px-8 lg:px-12 lg:py-10">
        <div className="mx-auto max-w-5xl">{children}</div>
      </main>
    </div>
  );
}
