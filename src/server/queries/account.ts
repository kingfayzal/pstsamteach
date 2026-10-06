import "server-only";
import { db } from "@/server/db";

export async function getProfile(userId: string) {
  return db.user.findUniqueOrThrow({ where: { id: userId }, select: { name: true, bio: true, timeZone: true, email: true, emailVerifiedAt: true } });
}

/** The address still waiting to be confirmed, or null once it is (for the reminder banner). */
export async function getUnconfirmedEmail(userId: string): Promise<string | null> {
  const user = await db.user.findUnique({ where: { id: userId }, select: { email: true, emailVerifiedAt: true } });
  return user && !user.emailVerifiedAt ? user.email : null;
}
