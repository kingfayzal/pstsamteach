import "server-only";
import { isListed, profileGaps } from "@/lib/teacher-directory";
import type { Interval } from "@/lib/scheduling";
import type { Db, Tx } from "@/server/db";

/** Sessions that block a slot: confirmed ones, and requests that haven't lapsed. */
export async function busyIntervals(
  client: Db | Tx,
  who: { teacherId?: string; studentId?: string },
  now: Date,
  until: Date,
): Promise<Interval[]> {
  const party = [
    ...(who.teacherId ? [{ teacherId: who.teacherId }] : []),
    ...(who.studentId ? [{ connection: { studentId: who.studentId } }] : []),
  ];
  if (party.length === 0) return [];
  const sessions = await client.tutoringSession.findMany({
    where: {
      OR: party,
      startsAt: { lt: until },
      endsAt: { gt: now },
      AND: [{ OR: [{ status: "CONFIRMED" }, { status: "REQUESTED", startsAt: { gt: now } }] }],
    },
    select: { startsAt: true, endsAt: true },
  });
  return sessions.map((s) => ({ start: s.startsAt, end: s.endsAt }));
}

export const schedulingProfileSelect = {
  id: true,
  userId: true,
  slug: true,
  headline: true,
  about: true,
  timeZone: true,
  sessionMinutes: true,
  acceptingStudents: true,
  isHidden: true,
  availability: { select: { weekday: true, startMinute: true, endMinute: true } },
  topics: { select: { topicId: true } },
  _count: { select: { languages: true } },
  user: { select: { id: true, name: true, role: true, status: true } },
} as const;

type SchedulingProfile = {
  headline: string;
  about: string;
  isHidden: boolean;
  availability: readonly unknown[];
  topics: readonly unknown[];
  _count: { languages: number };
  user: { role: "STUDENT" | "TEACHER" | "ADMIN"; status: "ACTIVE" | "PENDING" | "SUSPENDED" };
};

export function listingGaps(profile: SchedulingProfile): string[] {
  return profileGaps({
    headline: profile.headline,
    about: profile.about,
    topicCount: profile.topics.length,
    languageCount: profile._count.languages,
    windowCount: profile.availability.length,
  });
}

export function profileIsListed(profile: SchedulingProfile): boolean {
  return isListed({ gaps: listingGaps(profile), isHidden: profile.isHidden, role: profile.user.role, status: profile.user.status });
}

export async function loadSchedulingProfile(client: Db | Tx, teacherId: string) {
  return client.teacherProfile.findUnique({ where: { userId: teacherId }, select: schedulingProfileSelect });
}

/**
 * Serialise scheduling for these people until the transaction ends, using
 * Postgres advisory locks, so two bookings can't take the same slot at once.
 * Locks are taken in a fixed order to avoid deadlocks.
 */
export async function lockSchedules(tx: Tx, userIds: readonly string[]): Promise<void> {
  for (const id of [...new Set(userIds)].sort()) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`schedule:${id}`}))`;
  }
}
