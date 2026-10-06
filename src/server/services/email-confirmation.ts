import "server-only";
import { emailChangeSchema } from "@/lib/validation/auth";
import { findAccountToken, isUsable, issueAccountToken, spendAccountToken } from "@/server/auth/account-tokens";
import { db, type Tx } from "@/server/db";
import { absoluteUrl, enqueueEmail } from "@/server/email";
import { type Actor, fail, forbidden, invalid, notFound, ok, type ServiceError, type ServiceResult } from "./result";

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

const ADDRESS_TAKEN = "Another account already uses that address. Log in to it instead, or use a different address.";
const SAME_ADDRESS = "That's the address we already have. Send a new link to it instead.";

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code: string }).code === "P2002";
}

/**
 * Fix a mistyped address before it's confirmed: the account moves to the new
 * address and a fresh link goes there. Links sent to the old address stop
 * working, because a link only counts for the address it went to. Once an
 * address is confirmed it can't be changed here.
 */
export async function changeUnconfirmedEmail(actor: Actor, input: unknown, now = new Date()): Promise<ServiceResult<{ email: string }>> {
  if (actor.status === "SUSPENDED") return forbidden();
  const parsed = emailChangeSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const user = await db.user.findUnique({ where: { id: actor.id }, select: { id: true, email: true, emailVerifiedAt: true } });
  if (!user) return notFound("Your account");
  if (user.emailVerifiedAt) return fail("CONFLICT", "Your email address is already confirmed.");
  const { email } = parsed.data;
  if (email === user.email) return fail("INVALID", SAME_ADDRESS, { email: [SAME_ADDRESS] });
  if ((await db.user.count({ where: { email } })) > 0) return fail("CONFLICT", ADDRESS_TAKEN, { email: [ADDRESS_TAKEN] });

  try {
    await db.$transaction(async (tx) => {
      const moved = await tx.user.update({ where: { id: user.id }, data: { email }, select: { id: true, name: true, email: true } });
      await queueConfirmationEmail(tx, moved, { kind: "confirm-email" }, now);
    });
  } catch (error) {
    if (isUniqueViolation(error)) return fail("CONFLICT", ADDRESS_TAKEN, { email: [ADDRESS_TAKEN] });
    throw error;
  }
  return ok({ email });
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
 * Requesting a teacher, accepting a student, booking and messaging refuse an
 * unconfirmed address. Unconfirmed accounts are already held at the confirm page
 * (requireUser); this is the same rule enforced where the change happens, in case
 * a caller ever skips that. Returns the refusal, or null to go ahead.
 */
export async function requireConfirmedEmail(actor: Actor): Promise<ServiceError | null> {
  const user = await db.user.findUnique({ where: { id: actor.id }, select: { email: true, emailVerifiedAt: true } });
  if (user?.emailVerifiedAt) return null;
  return fail(
    "FORBIDDEN",
    `Confirm your email address first: open the link we sent to ${user?.email ?? actor.email}.`,
  );
}
