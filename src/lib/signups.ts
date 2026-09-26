const DAY_MS = 24 * 60 * 60 * 1000;

export type DailyCount = { date: string; students: number; teachers: number };

type SignupRow = { createdAt: Date; role: "STUDENT" | "TEACHER" | "ADMIN" };

/** Sign-ups per UTC day for the last `days` days, oldest first, with empty days filled in. */
export function bucketSignups(rows: readonly SignupRow[], days: number, now = new Date()): DailyCount[] {
  const start = new Date(now);
  start.setUTCHours(0, 0, 0, 0);
  start.setTime(start.getTime() - (days - 1) * DAY_MS);
  const buckets = Array.from({ length: days }, (_, i) => ({
    date: new Date(start.getTime() + i * DAY_MS).toISOString().slice(0, 10),
    students: 0,
    teachers: 0,
  }));
  return rows.reduce((acc, row) => {
    const index = Math.floor((row.createdAt.getTime() - start.getTime()) / DAY_MS);
    const bucket = acc[index];
    if (!bucket || row.role === "ADMIN") return acc;
    const next = row.role === "TEACHER" ? { ...bucket, teachers: bucket.teachers + 1 } : { ...bucket, students: bucket.students + 1 };
    return acc.map((b, i) => (i === index ? next : b));
  }, buckets);
}
