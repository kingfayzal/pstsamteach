import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import type { Role } from "@/generated/prisma/enums";
import { homePathFor } from "@/lib/routes";
import type { Actor } from "@/server/services/result";
import { createSessionRecord, findActorBySessionToken, revokeSessionToken, revokeUserSessions } from "./session-store";

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

/** The signed-in user for this request, or null. Deduplicated per render. */
export const getCurrentUser = cache(async (): Promise<Actor | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return findActorBySessionToken(token);
});

export async function requireUser(): Promise<Actor> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** Guard a whole area. Wrong role goes home; pending teachers only see their status page. */
export async function requireRole(role: Role, options: { allowPending?: boolean } = {}): Promise<Actor> {
  const user = await requireUser();
  if (user.role !== role) redirect(homePathFor(user));
  if (user.status === "PENDING" && !options.allowPending) redirect(homePathFor(user));
  return user;
}

