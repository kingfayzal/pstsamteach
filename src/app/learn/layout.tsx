import { AppShell } from "@/components/shell/app-shell";
import { AREA_LABEL, navFor } from "@/lib/nav";
import { requireRole } from "@/server/auth/session";

export default async function LearnLayout({ children }: LayoutProps<"/learn">) {
  const user = await requireRole("STUDENT");
  return (
    <AppShell area={AREA_LABEL.STUDENT} home="/learn" nav={navFor("STUDENT")} user={user}>
      {children}
    </AppShell>
  );
}
