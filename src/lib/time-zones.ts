/**
 * Time-zone arithmetic on top of Intl, with no dependencies. Everything is
 * stored as UTC instants; these helpers translate to and from wall-clock time
 * in an IANA zone.
 */

export const FALLBACK_TIME_ZONE = "UTC";

export type CalendarDate = { year: number; month: number; day: number };
export type WallTime = CalendarDate & { hour: number; minute: number };
export type ZonedParts = WallTime & { weekday: number };

const WEEKDAYS: Readonly<Record<string, number>> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
const formatters = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(timeZone: string): Intl.DateTimeFormat {
  let formatter = formatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      weekday: "short",
    });
    formatters.set(timeZone, formatter);
  }
  return formatter;
}

export function isValidTimeZone(value: unknown): value is string {
  if (typeof value !== "string" || value.length === 0 || value.length > 64) return false;
  try {
    partsFormatter(value);
    return true;
  } catch {
    return false;
  }
}

/** The first valid zone among the candidates, else UTC. */
export function resolveTimeZone(...candidates: unknown[]): string {
  return (candidates.find(isValidTimeZone) as string | undefined) ?? FALLBACK_TIME_ZONE;
}

export function listTimeZones(): string[] {
  return Intl.supportedValuesOf("timeZone");
}

/** Wall-clock date, time and weekday of an instant in a zone. */
export function zonedParts(date: Date, timeZone: string): ZonedParts {
  const map: Record<string, string> = {};
  for (const part of partsFormatter(timeZone).formatToParts(date)) map[part.type] = part.value;
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
    weekday: WEEKDAYS[map.weekday] ?? 0,
  };
}

/** Milliseconds the zone is ahead of UTC at an instant. */
function offsetAt(ms: number, timeZone: string): number {
  const floored = Math.floor(ms / 60_000) * 60_000;
  const p = zonedParts(new Date(floored), timeZone);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute) - floored;
}

/**
 * The instant a wall-clock time happens in a zone. Hour 24 means midnight at
 * the end of the day. Times skipped by a daylight-saving jump resolve to the
 * equivalent instant just after the jump.
 */
export function zonedTimeToUtc(wall: WallTime, timeZone: string): Date {
  const asIfUtc = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute);
  const firstOffset = offsetAt(asIfUtc, timeZone);
  const guess = asIfUtc - firstOffset;
  const secondOffset = offsetAt(guess, timeZone);
  return new Date(secondOffset === firstOffset ? guess : asIfUtc - secondOffset);
}

export function addDays(date: CalendarDate, days: number): CalendarDate {
  const d = new Date(Date.UTC(date.year, date.month - 1, date.day + days));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

/** Weekday of a calendar date (0 = Sunday), independent of any zone. */
export function weekdayOf(date: CalendarDate): number {
  return new Date(Date.UTC(date.year, date.month - 1, date.day)).getUTCDay();
}

const pad = (n: number) => String(n).padStart(2, "0");

/** YYYY-MM-DD of the instant's local date in a zone. */
export function dayKey(date: Date, timeZone: string): string {
  const p = zonedParts(date, timeZone);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

export function formatInZone(date: Date, timeZone: string, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat("en-GB", { ...options, timeZone }).format(date);
}

/** e.g. "Tue 29 Sept, 18:00" in the viewer's zone. */
export function formatSlot(date: Date, timeZone: string): string {
  return formatInZone(date, timeZone, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function formatClock(date: Date, timeZone: string): string {
  return formatInZone(date, timeZone, { hour: "2-digit", minute: "2-digit" });
}

/** "18:30" from minutes after midnight; 1440 reads "24:00". */
export function minutesToClock(minutes: number): string {
  return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
}
