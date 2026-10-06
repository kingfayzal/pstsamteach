import { AppShell } from "@/components/shell/app-shell";
import { AREA_LABEL, navFor } from "@/lib/nav";
import { requireRole } from "@/server/auth/session";
import { getUnconfirmedEmail } from "@/server/queries/account";
import { countUnreadMessages } from "@/server/queries/connections";

export default async function LearnLayout({ children }: LayoutProps<"/learn">) {
  const user = await requireRole("STUDENT");
  const [unread, unconfirmedEmail] = await Promise.all([countUnreadMessages(user.id), getUnconfirmedEmail(user.id)]);
  return (
    <AppShell area={AREA_LABEL.STUDENT} home="/learn" nav={navFor("STUDENT", { "/learn/teachers": unread })} user={user} unconfirmedEmail={unconfirmedEmail}>
      {children}
    </AppShell>
  );
}
