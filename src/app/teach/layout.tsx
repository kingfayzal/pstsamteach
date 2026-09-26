import { AppShell } from "@/components/shell/app-shell";
import { AREA_LABEL, navFor } from "@/lib/nav";
import { requireRole } from "@/server/auth/session";
import { getTeacherStats } from "@/server/queries/teacher";

export default async function TeachLayout({ children }: LayoutProps<"/teach">) {
  const user = await requireRole("TEACHER", { allowPending: true });

  if (user.status === "PENDING") {
    return (
      <AppShell area={AREA_LABEL.TEACHER} home="/teach/pending" nav={[{ href: "/teach/pending", label: "Your application" }]} user={user}>
        {children}
      </AppShell>
    );
  }

  const stats = await getTeacherStats(user);
  return (
    <AppShell area={AREA_LABEL.TEACHER} home="/teach" nav={navFor("TEACHER", { "/teach/marking": stats.awaiting })} user={user}>
      {children}
    </AppShell>
  );
}
