import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import { resolveTimeZone } from "@/lib/time-zones";
import { TZ_COOKIE } from "@/lib/time-zone-cookie";
import { db } from "@/server/db";
import { getCurrentUser } from "./session";

/** The browser's zone as reported by TimeZoneSync, if valid. */
export async function getBrowserTimeZone(): Promise<string | undefined> {
  const raw = (await cookies()).get(TZ_COOKIE)?.value;
  if (!raw) return undefined;
  try {
    return decodeURIComponent(raw);
  } catch {
    return undefined;
  }
}

/** The zone to show times in: the account setting, else the browser's, else UTC. */
export const getViewerTimeZone = cache(async (): Promise<string> => {
  const user = await getCurrentUser();
  const stored = user ? (await db.user.findUnique({ where: { id: user.id }, select: { timeZone: true } }))?.timeZone : null;
  return resolveTimeZone(stored, await getBrowserTimeZone());
});
