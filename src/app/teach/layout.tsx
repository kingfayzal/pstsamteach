import { AppShell } from "@/components/shell/app-shell";
import { AREA_LABEL, navFor, PENDING_TEACHER_NAV } from "@/lib/nav";
import { requireRole } from "@/server/auth/session";
import { countPendingRequests, countUnreadMessages } from "@/server/queries/connections";
import { getTeacherStats } from "@/server/queries/teacher";

export default async function TeachLayout({ children }: LayoutProps<"/teach">) {
  const user = await requireRole("TEACHER", { allowPending: true });

  if (user.status === "PENDING") {
    return (
      <AppShell area={AREA_LABEL.TEACHER} home="/teach/pending" nav={[...PENDING_TEACHER_NAV]} user={user}>
        {children}
      </AppShell>
    );
  }

  const [stats, requests, unread] = await Promise.all([getTeacherStats(user), countPendingRequests(user.id), countUnreadMessages(user.id)]);
  const nav = navFor("TEACHER", { "/teach/marking": stats.awaiting, "/teach/students": requests + unread });
  return (
    <AppShell area={AREA_LABEL.TEACHER} home="/teach" nav={nav} user={user}>
      {children}
    </AppShell>
  );
}
