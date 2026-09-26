import { addDays, dayKey, weekdayOf, zonedParts, zonedTimeToUtc, type CalendarDate } from "./time-zones";

export type AvailabilityWindowInput = { weekday: number; startMinute: number; endMinute: number };
export type Interval = { start: Date; end: Date };

export const SLOT_STEP_MINUTES = 30;
export const BOOKING_HORIZON_DAYS = 14;
export const MIN_NOTICE_MINUTES = 12 * 60;
export const SESSION_LENGTHS = [30, 45, 60, 90] as const;
export type SessionLength = (typeof SESSION_LENGTHS)[number];

const MINUTE = 60_000;

function atMinute(date: CalendarDate, minuteOfDay: number, timeZone: string): Date {
  return zonedTimeToUtc({ ...date, hour: Math.floor(minuteOfDay / 60), minute: minuteOfDay % 60 }, timeZone);
}

/**
 * Concrete UTC intervals for weekly windows, over `days` local calendar days
 * starting with the teacher-local date of `from`. Intervals already over are dropped.
 */
export function availabilityIntervals(
  windows: readonly AvailabilityWindowInput[],
  timeZone: string,
  from: Date,
  days: number,
): Interval[] {
  const today = zonedParts(from, timeZone);
  const intervals: Interval[] = [];
  for (let offset = 0; offset < days; offset++) {
    const date = addDays(today, offset);
    const weekday = weekdayOf(date);
    for (const window of windows) {
      if (window.weekday !== weekday) continue;
      const start = atMinute(date, window.startMinute, timeZone);
      const end = atMinute(date, window.endMinute, timeZone);
      if (end > from && end > start) intervals.push({ start, end });
    }
  }
  return intervals.sort((a, b) => a.start.getTime() - b.start.getTime());
}

/**
 * One of each weekday's windows, starting at the teacher-local midnight of
 * today. Unlike booking, nothing is dropped for having passed already, so a
 * timetable or day filter always shows the whole week.
 */
export function typicalWeek(windows: readonly AvailabilityWindowInput[], timeZone: string, now: Date): Interval[] {
  const today = zonedParts(now, timeZone);
  const midnight = zonedTimeToUtc({ year: today.year, month: today.month, day: today.day, hour: 0, minute: 0 }, timeZone);
  return availabilityIntervals(windows, timeZone, midnight, 7);
}

export function overlaps(a: Interval, b: Interval): boolean {
  return a.start < b.end && b.start < a.end;
}

export type SlotOptions = {
  windows: readonly AvailabilityWindowInput[];
  timeZone: string;
  sessionMinutes: number;
  now: Date;
  days?: number;
  minNoticeMinutes?: number;
  stepMinutes?: number;
  busy?: readonly Interval[];
};

/** Bookable session start times: inside availability, with notice, clear of busy time. */
export function generateSlots(options: SlotOptions): Interval[] {
  const {
    windows,
    timeZone,
    sessionMinutes,
    now,
    days = BOOKING_HORIZON_DAYS,
    minNoticeMinutes = MIN_NOTICE_MINUTES,
    stepMinutes = SLOT_STEP_MINUTES,
    busy = [],
  } = options;
  const earliest = now.getTime() + minNoticeMinutes * MINUTE;
  const length = sessionMinutes * MINUTE;
  const step = stepMinutes * MINUTE;
  const seen = new Set<number>();
  const slots: Interval[] = [];

  for (const interval of availabilityIntervals(windows, timeZone, now, days)) {
    for (let t = interval.start.getTime(); t + length <= interval.end.getTime(); t += step) {
      if (t < earliest || seen.has(t)) continue;
      const slot = { start: new Date(t), end: new Date(t + length) };
      if (busy.some((b) => overlaps(slot, b))) continue;
      seen.add(t);
      slots.push(slot);
    }
  }
  return slots.sort((a, b) => a.start.getTime() - b.start.getTime());
}

export function nextAvailableSlot(options: SlotOptions): Interval | null {
  return generateSlots(options)[0] ?? null;
}

/** The slot starting exactly at `start`, if it's genuinely bookable right now. */
export function findBookableSlot(start: Date, options: SlotOptions): Interval | null {
  return generateSlots(options).find((slot) => slot.start.getTime() === start.getTime()) ?? null;
}

export const TIME_BANDS = [
  { key: "morning", label: "Morning", hours: "06–12" },
  { key: "afternoon", label: "Afternoon", hours: "12–17" },
  { key: "evening", label: "Evening", hours: "17–22" },
  { key: "night", label: "Night", hours: "22–06" },
] as const;
export type BandKey = (typeof TIME_BANDS)[number]["key"];

export function bandOf(minuteOfDay: number): BandKey {
  if (minuteOfDay >= 6 * 60 && minuteOfDay < 12 * 60) return "morning";
  if (minuteOfDay >= 12 * 60 && minuteOfDay < 17 * 60) return "afternoon";
  if (minuteOfDay >= 17 * 60 && minuteOfDay < 22 * 60) return "evening";
  return "night";
}

export type Timetable = Record<number, Record<BandKey, boolean>>;

function emptyTimetable(): Timetable {
  return Object.fromEntries(
    Array.from({ length: 7 }, (_, day) => [day, { morning: false, afternoon: false, evening: false, night: false }]),
  ) as Timetable;
}

/** Which day/time-of-day cells the intervals touch, in the viewer's zone. */
export function weeklyTimetable(intervals: readonly Interval[], viewerTimeZone: string): Timetable {
  const table = emptyTimetable();
  for (const interval of intervals) {
    for (let t = interval.start.getTime(); t < interval.end.getTime(); t += SLOT_STEP_MINUTES * MINUTE) {
      const p = zonedParts(new Date(t), viewerTimeZone);
      table[p.weekday] = { ...table[p.weekday], [bandOf(p.hour * 60 + p.minute)]: true };
    }
  }
  return table;
}

export function availabilityMatches(
  intervals: readonly Interval[],
  viewerTimeZone: string,
  filter: { weekday?: number; band?: BandKey },
): boolean {
  if (filter.weekday === undefined && filter.band === undefined) return true;
  const table = weeklyTimetable(intervals, viewerTimeZone);
  const days = filter.weekday === undefined ? [0, 1, 2, 3, 4, 5, 6] : [filter.weekday];
  return days.some((day) => (filter.band ? table[day][filter.band] : Object.values(table[day]).some(Boolean)));
}

export type SlotDay = { key: string; date: Date; slots: Interval[] };

/** Slots grouped by the viewer's local calendar date, in order. */
export function groupSlotsByDay(slots: readonly Interval[], viewerTimeZone: string): SlotDay[] {
  const days = new Map<string, SlotDay>();
  for (const slot of slots) {
    const key = dayKey(slot.start, viewerTimeZone);
    const existing = days.get(key);
    days.set(key, existing ? { ...existing, slots: [...existing.slots, slot] } : { key, date: slot.start, slots: [slot] });
  }
  return [...days.values()];
}
