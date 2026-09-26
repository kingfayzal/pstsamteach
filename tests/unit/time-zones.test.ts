import { describe, expect, it } from "vitest";
import { addDays, dayKey, isValidTimeZone, resolveTimeZone, zonedParts, zonedTimeToUtc } from "@/lib/time-zones";

describe("isValidTimeZone", () => {
  it("accepts IANA zones and rejects everything else", () => {
    expect(isValidTimeZone("Africa/Lagos")).toBe(true);
    expect(isValidTimeZone("America/New_York")).toBe(true);
    expect(isValidTimeZone("UTC")).toBe(true);
    expect(isValidTimeZone("Mars/Base")).toBe(false);
    expect(isValidTimeZone("")).toBe(false);
    expect(isValidTimeZone(42)).toBe(false);
    expect(isValidTimeZone(undefined)).toBe(false);
  });
});

describe("resolveTimeZone", () => {
  it("takes the first valid candidate, else UTC", () => {
    expect(resolveTimeZone(null, "bad", "Europe/London", "Africa/Lagos")).toBe("Europe/London");
    expect(resolveTimeZone(undefined, "")).toBe("UTC");
    expect(resolveTimeZone()).toBe("UTC");
  });
});

describe("zonedTimeToUtc", () => {
  it("converts a zone without daylight saving", () => {
    expect(zonedTimeToUtc({ year: 2026, month: 9, day: 28, hour: 18, minute: 0 }, "Africa/Lagos").toISOString()).toBe(
      "2026-09-28T17:00:00.000Z",
    );
  });

  it("handles half-hour offsets", () => {
    expect(zonedTimeToUtc({ year: 2026, month: 9, day: 28, hour: 9, minute: 0 }, "Asia/Kolkata").toISOString()).toBe(
      "2026-09-28T03:30:00.000Z",
    );
  });

  it("follows daylight saving in summer and winter", () => {
    expect(zonedTimeToUtc({ year: 2026, month: 7, day: 1, hour: 9, minute: 0 }, "America/New_York").toISOString()).toBe(
      "2026-07-01T13:00:00.000Z",
    );
    expect(zonedTimeToUtc({ year: 2026, month: 1, day: 15, hour: 9, minute: 0 }, "America/New_York").toISOString()).toBe(
      "2026-01-15T14:00:00.000Z",
    );
  });

  it("is correct on the day the clocks change", () => {
    // 8 March 2026: New York springs forward at 02:00.
    expect(zonedTimeToUtc({ year: 2026, month: 3, day: 8, hour: 1, minute: 30 }, "America/New_York").toISOString()).toBe(
      "2026-03-08T06:30:00.000Z",
    );
    expect(zonedTimeToUtc({ year: 2026, month: 3, day: 8, hour: 3, minute: 30 }, "America/New_York").toISOString()).toBe(
      "2026-03-08T07:30:00.000Z",
    );
  });

  it("treats minute 1440 as midnight at the end of the day", () => {
    expect(zonedTimeToUtc({ year: 2026, month: 9, day: 28, hour: 24, minute: 0 }, "UTC").toISOString()).toBe(
      "2026-09-29T00:00:00.000Z",
    );
  });
});

describe("zonedParts", () => {
  it("reads the local calendar date, time and weekday", () => {
    expect(zonedParts(new Date("2026-09-28T23:30:00Z"), "Africa/Lagos")).toEqual({
      year: 2026,
      month: 9,
      day: 29,
      hour: 0,
      minute: 30,
      weekday: 2,
    });
    expect(zonedParts(new Date("2026-09-28T03:00:00Z"), "America/New_York")).toMatchObject({ day: 27, hour: 23, weekday: 0 });
  });
});

describe("calendar helpers", () => {
  it("adds days across month and year ends", () => {
    expect(addDays({ year: 2026, month: 9, day: 30 }, 1)).toEqual({ year: 2026, month: 10, day: 1 });
    expect(addDays({ year: 2026, month: 12, day: 31 }, 1)).toEqual({ year: 2027, month: 1, day: 1 });
    expect(addDays({ year: 2026, month: 3, day: 1 }, -1)).toEqual({ year: 2026, month: 2, day: 28 });
  });

  it("builds a local day key", () => {
    expect(dayKey(new Date("2026-09-28T23:30:00Z"), "Africa/Lagos")).toBe("2026-09-29");
    expect(dayKey(new Date("2026-09-28T23:30:00Z"), "UTC")).toBe("2026-09-28");
  });
});
