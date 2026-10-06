import { AppShell } from "@/components/shell/app-shell";
import { AREA_LABEL, navFor, PENDING_TEACHER_NAV } from "@/lib/nav";
import { requireRole } from "@/server/auth/session";
import { getUnconfirmedEmail } from "@/server/queries/account";
import { countPendingRequests, countUnreadMessages } from "@/server/queries/connections";
import { getTeacherStats } from "@/server/queries/teacher";

export default async function TeachLayout({ children }: LayoutProps<"/teach">) {
  const user = await requireRole("TEACHER", { allowPending: true });
  const unconfirmedEmail = await getUnconfirmedEmail(user.id);

  if (user.status === "PENDING") {
    return (
      <AppShell area={AREA_LABEL.TEACHER} home="/teach/pending" nav={[...PENDING_TEACHER_NAV]} user={user} unconfirmedEmail={unconfirmedEmail}>
        {children}
      </AppShell>
    );
  }

  const [stats, requests, unread] = await Promise.all([getTeacherStats(user), countPendingRequests(user.id), countUnreadMessages(user.id)]);
  const nav = navFor("TEACHER", { "/teach/marking": stats.awaiting, "/teach/students": requests + unread });
  return (
    <AppShell area={AREA_LABEL.TEACHER} home="/teach" nav={nav} user={user} unconfirmedEmail={unconfirmedEmail}>
      {children}
    </AppShell>
  );
}
