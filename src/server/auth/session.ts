import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import type { Role } from "@/generated/prisma/enums";
import { homePathFor, signedInGate } from "@/lib/routes";
import type { Actor } from "@/server/services/result";
import { createSessionRecord, findSessionByToken, revokeSessionToken, revokeUserSessions, type SessionUser } from "./session-store";

export const SESSION_COOKIE = "st_session";

export async function startSession(userId: string): Promise<void> {
  const { token, expiresAt } = await createSessionRecord(userId);
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function endSession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) await revokeSessionToken(token);
  store.delete(SESSION_COOKIE);
}

/** Sign the user out everywhere except this browser (e.g. after a password change). */
export async function endOtherSessions(userId: string): Promise<void> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  await revokeUserSessions(userId, token);
}

/** This request's session and whether its email address is confirmed, or null. Deduplicated per render. */
const getSession = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return findSessionByToken(token);
});

/** Who is signed in, confirmed or not. For showing things; use requireUser/requireRole to act. */
export const getCurrentUser = cache(async (): Promise<Actor | null> => (await getSession())?.actor ?? null);

/** True when someone is signed in but hasn't confirmed their email address yet. */
export async function needsEmailConfirmation(): Promise<boolean> {
  const session = await getSession();
  return session !== null && !session.emailConfirmed;
}

type GateOptions = { allowUnconfirmed?: boolean };

/**
 * The signed-in user, for any page or action that needs an account. Without a
 * session it goes to log in; with an unconfirmed email address it goes to the
 * confirm-your-email page, whatever the role. Only that page and its own
 * actions pass `allowUnconfirmed`.
 */
export async function requireUser(options: GateOptions = {}): Promise<Actor> {
  const session = await getSession();
  const blocked = signedInGate(session, options);
  if (blocked || !session) redirect(blocked ?? "/login");
  return session.actor;
}

/** Guard a whole area. Wrong role goes home; pending teachers only see their status page. */
export async function requireRole(role: Role, options: { allowPending?: boolean } & GateOptions = {}): Promise<Actor> {
  const user = await requireUser({ allowUnconfirmed: options.allowUnconfirmed });
  if (user.role !== role) redirect(homePathFor(user));
  if (user.status === "PENDING" && !options.allowPending) redirect(homePathFor(user));
  return user;
}

