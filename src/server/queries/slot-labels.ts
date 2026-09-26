import "server-only";
import type { SlotDay } from "@/lib/scheduling";
import { formatClock, formatInZone } from "@/lib/time-zones";
import type { SlotGroup } from "@/components/forms/slot-picker";

/** Pre-format slot groups in the viewer's zone so the client never re-interprets times. */
export function labelSlotGroups(days: readonly SlotDay[], timeZone: string): SlotGroup[] {
  return days.map((day) => ({
    key: day.key,
    label: formatInZone(day.date, timeZone, { weekday: "short", day: "numeric", month: "short" }),
    slots: day.slots.map((slot) => ({ value: slot.start.toISOString(), label: formatClock(slot.start, timeZone) })),
  }));
}
