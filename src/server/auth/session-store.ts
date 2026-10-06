import "server-only";
import { db } from "@/server/db";
import type { Actor } from "@/server/services/result";
import { hashToken, newSessionToken } from "./tokens";

export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** Create a session row and return the raw token for the cookie. */
export async function createSessionRecord(userId: string, now = new Date()): Promise<{ token: string; expiresAt: Date }> {
  const token = newSessionToken();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);
  await db.session.create({ data: { id: hashToken(token), userId, expiresAt } });
  return { token, expiresAt };
}

export type SessionUser = { actor: Actor; emailConfirmed: boolean };

/**
 * Resolve a cookie token to its user, and whether their email address is
 * confirmed yet. Expired sessions are removed; suspended users get no session
 * at all, so suspension takes effect on the next request.
 */
export async function findSessionByToken(token: string, now = new Date()): Promise<SessionUser | null> {
  if (!token) return null;
  const session = await db.session.findUnique({
    where: { id: hashToken(token) },
    include: { user: { select: { id: true, name: true, email: true, role: true, status: true, emailVerifiedAt: true } } },
  });
  if (!session) return null;
  if (session.expiresAt <= now) {
    await db.session.deleteMany({ where: { id: session.id } });
    return null;
  }
  if (session.user.status === "SUSPENDED") return null;
  const { emailVerifiedAt, ...actor } = session.user;
  return { actor, emailConfirmed: emailVerifiedAt !== null };
}

export async function findActorBySessionToken(token: string, now = new Date()): Promise<Actor | null> {
  return (await findSessionByToken(token, now))?.actor ?? null;
}

export async function revokeSessionToken(token: string): Promise<void> {
  await db.session.deleteMany({ where: { id: hashToken(token) } });
}

export async function revokeUserSessions(userId: string, exceptToken?: string): Promise<void> {
  const except = exceptToken ? hashToken(exceptToken) : undefined;
  await db.session.deleteMany({ where: { userId, ...(except ? { NOT: { id: except } } : {}) } });
}
