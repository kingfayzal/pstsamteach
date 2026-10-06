import "server-only";
import type { AccountTokenPurpose } from "@/generated/prisma/enums";
import { CONFIRM_LINK_DAYS, RESET_LINK_MINUTES } from "@/lib/email/templates";
import type { Db, Tx } from "@/server/db";
import { hashToken, newSessionToken } from "./tokens";

const MINUTE = 60 * 1000;

export const ACCOUNT_TOKEN_TTL_MS: Readonly<Record<AccountTokenPurpose, number>> = {
  VERIFY_EMAIL: CONFIRM_LINK_DAYS * 24 * 60 * MINUTE,
  RESET_PASSWORD: RESET_LINK_MINUTES * MINUTE,
};

/** Tokens are 32 random bytes in base64url; anything else can't be one, so skip the lookup. */
const TOKEN_SHAPE = /^[A-Za-z0-9_-]{43}$/;

/** Make a link token. Only its hash is stored, so a leaked row can't be turned back into a working link. */
export async function issueAccountToken(
  client: Db | Tx,
  input: { userId: string; email: string; purpose: AccountTokenPurpose; now: Date },
): Promise<{ token: string; expiresAt: Date }> {
  const token = newSessionToken();
  const expiresAt = new Date(input.now.getTime() + ACCOUNT_TOKEN_TTL_MS[input.purpose]);
  await client.accountToken.create({
    data: { id: hashToken(token), userId: input.userId, email: input.email, purpose: input.purpose, expiresAt, createdAt: input.now },
  });
  return { token, expiresAt };
}

export type FoundToken = {
  id: string;
  email: string;
  expiresAt: Date;
  usedAt: Date | null;
  user: { id: string; name: string; email: string; status: "ACTIVE" | "PENDING" | "SUSPENDED"; emailVerifiedAt: Date | null };
};

/** Look a token up whatever its state; callers decide what "used" or "expired" means for them. */
export async function findAccountToken(client: Db | Tx, token: unknown, purpose: AccountTokenPurpose): Promise<FoundToken | null> {
  if (typeof token !== "string" || !TOKEN_SHAPE.test(token)) return null;
  return client.accountToken.findFirst({
    where: { id: hashToken(token), purpose },
    select: {
      id: true,
      email: true,
      expiresAt: true,
      usedAt: true,
      user: { select: { id: true, name: true, email: true, status: true, emailVerifiedAt: true } },
    },
  });
}

/** Use a token once. Only the first of two simultaneous uses wins. */
export async function spendAccountToken(client: Db | Tx, id: string, now: Date): Promise<boolean> {
  const spent = await client.accountToken.updateMany({ where: { id, usedAt: null, expiresAt: { gt: now } }, data: { usedAt: now } });
  return spent.count === 1;
}

export function isUsable(token: Pick<FoundToken, "usedAt" | "expiresAt">, now: Date): boolean {
  return token.usedAt === null && token.expiresAt > now;
}
