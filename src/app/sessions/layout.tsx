import type { Viewport } from "next";
import { Wordmark } from "@/components/brand/wordmark";
import { homePathFor } from "@/lib/routes";
import { requireUser } from "@/server/auth/session";

/** The on-screen keyboard shrinks the page instead of covering the chat box. */
export const viewport: Viewport = { interactiveWidget: "resizes-content" };

/**
 * Session rooms skip the role shells' side rail, so the call gets the whole
 * screen. The page is exactly the viewport's height, so the call's controls are
 * always on screen; notices and the camera check scroll inside it instead.
 */
export default async function SessionsLayout({ children }: LayoutProps<"/sessions">) {
  const user = await requireUser();
  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-paper">
      <header className="flex shrink-0 items-center justify-between gap-4 border-b border-rule px-4 py-3 sm:px-6">
        <Wordmark href={homePathFor(user)} reload />
        <p className="truncate text-sm text-muted">{user.name}</p>
      </header>
      <main id="main" className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
