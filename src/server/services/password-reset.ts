import "server-only";
import { passwordResetRequestSchema, passwordResetSchema } from "@/lib/validation/auth";
import { findAccountToken, isUsable, issueAccountToken, spendAccountToken } from "@/server/auth/account-tokens";
import { hashPassword } from "@/server/auth/password";
import { db } from "@/server/db";
import { absoluteUrl, enqueueEmail } from "@/server/email";
import { actorSelect } from "./accounts";
import { type Actor, fail, invalid, ok, type ServiceResult } from "./result";

export const RESET_LINK_GONE = "This reset link has expired or has already been used. Ask for a new one below.";

/**
 * "Forgot your password?" Answers the same whether or not the address has an
 * account, so the form can't be used to find out who's registered.
 */
export async function requestPasswordReset(input: unknown, now = new Date()): Promise<ServiceResult<null>> {
  const parsed = passwordResetRequestSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const user = await db.user.findUnique({ where: { email: parsed.data.email }, select: { id: true, name: true, email: true, status: true } });
  // Suspended accounts can't sign in, so a new password wouldn't help them.
  if (!user || user.status === "SUSPENDED") return ok(null);

  await db.$transaction(async (tx) => {
    const { token, expiresAt } = await issueAccountToken(tx, { userId: user.id, email: user.email, purpose: "RESET_PASSWORD", now });
    await enqueueEmail(tx, {
      to: user.email,
      userId: user.id,
      expiresAt,
      now,
      message: { kind: "password-reset", data: { name: user.name, resetUrl: absoluteUrl("/reset-password", { token }) } },
    });
  });
  return ok(null);
}

async function findResetToken(token: unknown) {
  const found = await findAccountToken(db, token, "RESET_PASSWORD");
  if (!found || found.email !== found.user.email || found.user.status === "SUSPENDED") return null;
  return found;
}

/** Whether a reset link can still be used, without using it (for showing the form). */
export async function checkPasswordResetLink(token: unknown, now = new Date()): Promise<{ name: string } | null> {
  const found = await findResetToken(token);
  return found && isUsable(found, now) ? { name: found.user.name } : null;
}

/**
 * Set a new password from a reset link. The link works once; every other reset
 * link and every signed-in device stops working. Following the link proves the
 * person reads this inbox, so it confirms the address too.
 */
export async function resetPassword(input: unknown, now = new Date()): Promise<ServiceResult<Actor>> {
  const parsed = passwordResetSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const found = await findResetToken(parsed.data.token);
  if (!found || !isUsable(found, now)) return fail("INVALID", RESET_LINK_GONE);

  const passwordHash = await hashPassword(parsed.data.newPassword);
  const actor = await db.$transaction(async (tx) => {
    if (!(await spendAccountToken(tx, found.id, now))) return null;
    await tx.accountToken.updateMany({ where: { userId: found.user.id, purpose: "RESET_PASSWORD", usedAt: null }, data: { usedAt: now } });
    const user = await tx.user.update({
      where: { id: found.user.id },
      data: { passwordHash, emailVerifiedAt: found.user.emailVerifiedAt ?? now },
      select: actorSelect,
    });
    await tx.session.deleteMany({ where: { userId: user.id } });
    await enqueueEmail(tx, {
      to: user.email,
      userId: user.id,
      now,
      message: { kind: "password-changed", data: { name: user.name, resetUrl: absoluteUrl("/forgot-password") } },
    });
    return user;
  });
  return actor ? ok(actor) : fail("INVALID", RESET_LINK_GONE);
}
