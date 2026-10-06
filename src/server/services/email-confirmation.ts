import "server-only";
import { findAccountToken, isUsable, issueAccountToken, spendAccountToken } from "@/server/auth/account-tokens";
import { db, type Tx } from "@/server/db";
import { absoluteUrl, enqueueEmail } from "@/server/email";
import { type Actor, fail, forbidden, notFound, ok, type ServiceError, type ServiceResult } from "./result";

type Recipient = { id: string; name: string; email: string };

type ConfirmationTemplate = { kind: "welcome" } | { kind: "confirm-email" } | { kind: "teacher-application"; subjectName: string };

/** Queue an email with a fresh confirmation link, inside the caller's transaction. */
export async function queueConfirmationEmail(tx: Tx, user: Recipient, template: ConfirmationTemplate, now: Date): Promise<void> {
  const { token, expiresAt } = await issueAccountToken(tx, { userId: user.id, email: user.email, purpose: "VERIFY_EMAIL", now });
  const base = { name: user.name, confirmUrl: absoluteUrl("/confirm-email", { token }) };
  await enqueueEmail(tx, {
    to: user.email,
    userId: user.id,
    expiresAt,
    now,
    message:
      template.kind === "teacher-application"
        ? { kind: "teacher-application", data: { ...base, subjectName: template.subjectName } }
        : { kind: template.kind, data: base },
  });
}

/** Someone asks for another confirmation link (the first expired, or never arrived). */
export async function resendConfirmationEmail(actor: Actor, now = new Date()): Promise<ServiceResult<{ email: string }>> {
  if (actor.status === "SUSPENDED") return forbidden();
  const user = await db.user.findUnique({ where: { id: actor.id }, select: { id: true, name: true, email: true, emailVerifiedAt: true } });
  if (!user) return notFound("Your account");
  if (user.emailVerifiedAt) return fail("CONFLICT", "Your email address is already confirmed.");
  await db.$transaction((tx) => queueConfirmationEmail(tx, user, { kind: "confirm-email" }, now));
  return ok({ email: user.email });
}

export type ConfirmOutcome = "confirmed" | "already-confirmed";

const LINK_GONE = "This confirmation link has expired or doesn't work any more.";

/**
 * Follow a confirmation link. Mail scanners often open links before people do,
 * so a link that was already used on a now-confirmed address still counts as success.
 */
export async function confirmEmail(token: unknown, now = new Date()): Promise<ServiceResult<ConfirmOutcome>> {
  const found = await findAccountToken(db, token, "VERIFY_EMAIL");
  // The link is for the address it was sent to; if the account's email has changed since, it proves nothing.
  if (!found || found.email !== found.user.email) return fail("INVALID", LINK_GONE);
  if (found.user.emailVerifiedAt) return ok("already-confirmed");
  if (!isUsable(found, now)) return fail("INVALID", LINK_GONE);

  const confirmed = await db.$transaction(async (tx) => {
    if (!(await spendAccountToken(tx, found.id, now))) return false;
    await tx.user.updateMany({ where: { id: found.user.id, email: found.email, emailVerifiedAt: null }, data: { emailVerifiedAt: now } });
    return true;
  });
  if (confirmed) return ok("confirmed");
  // Lost a race with another click on the same link: fine if that one confirmed the address.
  const user = await db.user.findUnique({ where: { id: found.user.id }, select: { emailVerifiedAt: true } });
  return user?.emailVerifiedAt ? ok("already-confirmed") : fail("INVALID", LINK_GONE);
}

/**
 * Requesting a teacher, booking and messaging wait until the address is confirmed,
 * so teachers only hear from people we can reach. Returns the refusal, or null to go ahead.
 */
export async function requireConfirmedEmail(actor: Actor): Promise<ServiceError | null> {
  const user = await db.user.findUnique({ where: { id: actor.id }, select: { email: true, emailVerifiedAt: true } });
  if (user?.emailVerifiedAt) return null;
  return fail(
    "FORBIDDEN",
    `Confirm your email address first: open the link we sent to ${user?.email ?? actor.email}. You can send a new link from your Account page.`,
  );
}
