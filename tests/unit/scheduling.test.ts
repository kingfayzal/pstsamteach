import { describe, expect, it } from "vitest";
import {
  availabilityIntervals,
  availabilityMatches,
  bandOf,
  findBookableSlot,
  generateSlots,
  groupSlotsByDay,
  nextAvailableSlot,
  overlaps,
  weeklyTimetable,
} from "@/lib/scheduling";

const LAGOS = "Africa/Lagos";
// Monday 18:00–20:00 in Lagos (UTC+1) = 17:00–19:00 UTC.
const MONDAY_EVENING = [{ weekday: 1, startMinute: 18 * 60, endMinute: 20 * 60 }];
// Sunday 27 September 2026, midday UTC.
const SUNDAY_NOON = new Date("2026-09-27T12:00:00Z");

const iso = (d: Date) => d.toISOString();

describe("availabilityIntervals", () => {
  it("turns weekly windows into concrete UTC intervals", () => {
    const intervals = availabilityIntervals(MONDAY_EVENING, LAGOS, SUNDAY_NOON, 7);
    expect(intervals.map((i) => [iso(i.start), iso(i.end)])).toEqual([["2026-09-28T17:00:00.000Z", "2026-09-28T19:00:00.000Z"]]);
  });

  it("repeats every week within the horizon", () => {
    expect(availabilityIntervals(MONDAY_EVENING, LAGOS, SUNDAY_NOON, 14)).toHaveLength(2);
  });

  it("keeps a window that is already under way", () => {
    const during = new Date("2026-09-28T17:30:00Z");
    expect(availabilityIntervals(MONDAY_EVENING, LAGOS, during, 1)).toHaveLength(1);
  });

  it("supports windows running to midnight", () => {
    const [interval] = availabilityIntervals([{ weekday: 1, startMinute: 22 * 60, endMinute: 1440 }], "UTC", SUNDAY_NOON, 7);
    expect([iso(interval.start), iso(interval.end)]).toEqual(["2026-09-28T22:00:00.000Z", "2026-09-29T00:00:00.000Z"]);
  });

  it("follows daylight saving in the teacher's zone", () => {
    const sundayBefore = new Date("2026-03-07T12:00:00Z");
    const [interval] = availabilityIntervals([{ weekday: 0, startMinute: 9 * 60, endMinute: 10 * 60 }], "America/New_York", sundayBefore, 2);
    expect(iso(interval.start)).toBe("2026-03-08T13:00:00.000Z");
  });
});

describe("overlaps", () => {
  const at = (h: number) => new Date(Date.UTC(2026, 8, 28, h));
  it("detects overlap but not touching edges", () => {
    expect(overlaps({ start: at(17), end: at(18) }, { start: at(17), end: at(19) })).toBe(true);
    expect(overlaps({ start: at(17), end: at(18) }, { start: at(18), end: at(19) })).toBe(false);
  });
});

describe("generateSlots", () => {
  const base = { windows: MONDAY_EVENING, timeZone: LAGOS, sessionMinutes: 60, now: SUNDAY_NOON, days: 7 };

  it("offers every 30-minute start that fits the window", () => {
    expect(generateSlots(base).map((s) => iso(s.start))).toEqual([
      "2026-09-28T17:00:00.000Z",
      "2026-09-28T17:30:00.000Z",
      "2026-09-28T18:00:00.000Z",
    ]);
  });

  it("skips slots that clash with booked sessions", () => {
    const busy = [{ start: new Date("2026-09-28T17:00:00Z"), end: new Date("2026-09-28T18:00:00Z") }];
    expect(generateSlots({ ...base, busy }).map((s) => iso(s.start))).toEqual(["2026-09-28T18:00:00.000Z"]);
  });

  it("respects the minimum notice", () => {
    const now = new Date("2026-09-28T08:00:00Z");
    expect(generateSlots({ ...base, now, days: 7, minNoticeMinutes: 12 * 60 })).toHaveLength(0);
    expect(generateSlots({ ...base, now, days: 8, minNoticeMinutes: 12 * 60 })).toHaveLength(3);
  });

  it("returns nothing when no session fits", () => {
    expect(generateSlots({ ...base, sessionMinutes: 150 })).toEqual([]);
    expect(generateSlots({ ...base, windows: [] })).toEqual([]);
  });

  it("finds the next slot and validates a chosen one", () => {
    expect(iso(nextAvailableSlot(base)!.start)).toBe("2026-09-28T17:00:00.000Z");
    expect(nextAvailableSlot({ ...base, windows: [] })).toBeNull();

    const chosen = findBookableSlot(new Date("2026-09-28T17:30:00Z"), base);
    expect(chosen && iso(chosen.end)).toBe("2026-09-28T18:30:00.000Z");
    expect(findBookableSlot(new Date("2026-09-28T17:15:00Z"), base)).toBeNull();
    expect(findBookableSlot(new Date("2026-09-29T17:00:00Z"), base)).toBeNull();
  });
});

describe("time bands", () => {
  it("buckets minutes of the day", () => {
    expect(bandOf(5 * 60 + 59)).toBe("night");
    expect(bandOf(6 * 60)).toBe("morning");
    expect(bandOf(12 * 60)).toBe("afternoon");
    expect(bandOf(17 * 60)).toBe("evening");
    expect(bandOf(22 * 60)).toBe("night");
  });
});

describe("weeklyTimetable", () => {
  it("shows availability in the viewer's own time zone", () => {
    const intervals = availabilityIntervals(MONDAY_EVENING, LAGOS, SUNDAY_NOON, 7);
    // Lagos 18:00–20:00 is 22:30–00:30 in Kolkata: late Monday into early Tuesday.
    const table = weeklyTimetable(intervals, "Asia/Kolkata");
    expect(table[1].night).toBe(true);
    expect(table[2].night).toBe(true);
    expect(table[1].evening).toBe(false);

    const home = weeklyTimetable(intervals, LAGOS);
    expect(home[1].evening).toBe(true);
    expect(home[2].night).toBe(false);
  });

  it("filters by day and time of day", () => {
    const intervals = availabilityIntervals(MONDAY_EVENING, LAGOS, SUNDAY_NOON, 7);
    expect(availabilityMatches(intervals, LAGOS, {})).toBe(true);
    expect(availabilityMatches(intervals, LAGOS, { weekday: 1 })).toBe(true);
    expect(availabilityMatches(intervals, LAGOS, { weekday: 2 })).toBe(false);
    expect(availabilityMatches(intervals, LAGOS, { band: "evening" })).toBe(true);
    expect(availabilityMatches(intervals, LAGOS, { band: "morning" })).toBe(false);
    expect(availabilityMatches(intervals, LAGOS, { weekday: 1, band: "evening" })).toBe(true);
    expect(availabilityMatches([], LAGOS, { weekday: 1 })).toBe(false);
  });
});

describe("groupSlotsByDay", () => {
  it("groups by the viewer's local date", () => {
    const slots = generateSlots({ windows: MONDAY_EVENING, timeZone: LAGOS, sessionMinutes: 60, now: SUNDAY_NOON, days: 7 });
    const inKolkata = groupSlotsByDay(slots, "Asia/Kolkata");
    // 22:30 and 23:00 fall on Monday there; 23:30 is still Monday too.
    expect(inKolkata.map((d) => [d.key, d.slots.length])).toEqual([["2026-09-28", 3]]);
    const inAuckland = groupSlotsByDay(slots, "Pacific/Auckland");
    expect(inAuckland.map((d) => d.key)).toEqual(["2026-09-29"]);
  });
});

describe("typicalWeek", () => {
  it("covers all seven weekdays even after today's window has passed", async () => {
    const { typicalWeek } = await import("@/lib/scheduling");
    const saturdayMorning = [{ weekday: 6, startMinute: 9 * 60, endMinute: 13 * 60 }];
    // Saturday 26 Sept 2026, 23:00 UTC: the Saturday window ended hours ago.
    const lateSaturday = new Date("2026-09-26T23:00:00Z");
    expect(availabilityIntervals(saturdayMorning, "Africa/Accra", lateSaturday, 7)).toHaveLength(0);
    const week = typicalWeek(saturdayMorning, "Africa/Accra", lateSaturday);
    expect(week).toHaveLength(1);
    expect(weeklyTimetable(week, "Africa/Lagos")[6]).toMatchObject({ morning: true, afternoon: true });
  });
});
