import { describe, expect, it } from "vitest";
import { bucketSignups } from "@/lib/signups";

describe("bucketSignups", () => {
  const now = new Date("2026-09-26T15:00:00Z");

  it("fills every day, oldest first", () => {
    const buckets = bucketSignups([], 3, now);
    expect(buckets.map((b) => b.date)).toEqual(["2026-09-24", "2026-09-25", "2026-09-26"]);
    expect(buckets.every((b) => b.students === 0 && b.teachers === 0)).toBe(true);
  });

  it("counts students and teachers per day and ignores admins and old rows", () => {
    const buckets = bucketSignups(
      [
        { createdAt: new Date("2026-09-26T01:00:00Z"), role: "STUDENT" },
        { createdAt: new Date("2026-09-26T09:00:00Z"), role: "STUDENT" },
        { createdAt: new Date("2026-09-25T09:00:00Z"), role: "TEACHER" },
        { createdAt: new Date("2026-09-25T10:00:00Z"), role: "ADMIN" },
        { createdAt: new Date("2026-09-01T10:00:00Z"), role: "STUDENT" },
      ],
      3,
      now,
    );
    expect(buckets[2]).toEqual({ date: "2026-09-26", students: 2, teachers: 0 });
    expect(buckets[1]).toEqual({ date: "2026-09-25", students: 0, teachers: 1 });
  });
});
