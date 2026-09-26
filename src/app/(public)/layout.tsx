import { PublicFooter, PublicHeader } from "@/components/shell/public-chrome";
import { getCurrentUser } from "@/server/auth/session";

export default async function PublicLayout({ children }: LayoutProps<"/">) {
  const user = await getCurrentUser();
  return (
    <>
      <PublicHeader user={user} />
      <main id="main">{children}</main>
      <PublicFooter />
    </>
  );
}
