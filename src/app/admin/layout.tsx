import { AppShell } from "@/components/shell/app-shell";
import { AREA_LABEL, navFor } from "@/lib/nav";
import { requireRole } from "@/server/auth/session";
import { getReviewCount } from "@/server/queries/admin";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const user = await requireRole("ADMIN");
  const waiting = await getReviewCount();
  return (
    <AppShell area={AREA_LABEL.ADMIN} home="/admin" nav={navFor("ADMIN", { "/admin/review": waiting })} user={user}>
      {children}
    </AppShell>
  );
}
