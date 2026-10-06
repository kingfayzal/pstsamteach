import { ConfirmEmailBanner } from "@/components/shell/confirm-email-banner";
import { PublicFooter, PublicHeader } from "@/components/shell/public-chrome";
import { getCurrentUser } from "@/server/auth/session";
import { getUnconfirmedEmail } from "@/server/queries/account";

export default async function PublicLayout({ children }: LayoutProps<"/">) {
  const user = await getCurrentUser();
  const unconfirmedEmail = user ? await getUnconfirmedEmail(user.id) : null;
  return (
    <>
      <PublicHeader user={user} />
      {unconfirmedEmail ? (
        <div className="mx-auto max-w-6xl px-4 pt-6 sm:px-8">
          <ConfirmEmailBanner email={unconfirmedEmail} />
        </div>
      ) : null}
      <main id="main">{children}</main>
      <PublicFooter />
    </>
  );
}
