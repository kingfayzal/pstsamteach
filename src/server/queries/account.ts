import "server-only";
import { db } from "@/server/db";

export async function getProfile(userId: string) {
  return db.user.findUniqueOrThrow({ where: { id: userId }, select: { name: true, bio: true, timeZone: true } });
}
