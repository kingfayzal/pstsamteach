"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/fields";
import { SubmitButton } from "@/components/ui/submit-button";
import { WEEK_ORDER, WEEKDAY_NAMES } from "@/lib/teacher-directory";
import { minutesToClock } from "@/lib/time-zones";
import type { FormState } from "@/lib/validation/form";

type Window = { weekday: number; startMinute: number; endMinute: number };
type Props = { action: (state: FormState, form: FormData) => Promise<FormState>; initial: Window[]; timeZone: string };

const STEPS = Array.from({ length: 49 }, (_, i) => i * 30);
const MAX_PER_DAY = 5;

const PRESETS: { label: string; build: () => Window[] }[] = [
  { label: "Weekday evenings", build: () => [1, 2, 3, 4, 5].map((weekday) => ({ weekday, startMinute: 17 * 60, endMinute: 21 * 60 })) },
  { label: "Weekday daytime", build: () => [1, 2, 3, 4, 5].map((weekday) => ({ weekday, startMinute: 9 * 60, endMinute: 17 * 60 })) },
  { label: "Weekends", build: () => [6, 0].map((weekday) => ({ weekday, startMinute: 10 * 60, endMinute: 16 * 60 })) },
];

function TimeSelect({ value, onChange, min, max, label }: { value: number; onChange: (v: number) => void; min: number; max: number; label: string }) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="figures rounded-control border border-rule bg-sheet px-2 py-1.5 text-base text-ink"
    >
      {STEPS.filter((m) => m >= min && m <= max).map((m) => (
        <option key={m} value={m}>
          {minutesToClock(m)}
        </option>
      ))}
    </select>
  );
}

/** Weekly availability, edited as rows of time ranges per day. Saved as one JSON field. */
export function AvailabilityEditor({ action, initial, timeZone }: Props) {
  const [state, formAction] = useActionState(action, undefined);
  const [windows, setWindows] = useState<Window[]>(initial);

  const update = (index: number, patch: Partial<Window>) => setWindows((all) => all.map((w, i) => (i === index ? { ...w, ...patch } : w)));
  const remove = (index: number) => setWindows((all) => all.filter((_, i) => i !== index));
  const add = (weekday: number) =>
    setWindows((all) => {
      const sameDay = all.filter((w) => w.weekday === weekday);
      const start = Math.min(sameDay.reduce((latest, w) => Math.max(latest, w.endMinute), 17 * 60), 23 * 60);
      return [...all, { weekday, startMinute: start, endMinute: Math.min(start + 120, 1440) }];
    });

  return (
    <form action={formAction} className="max-w-3xl space-y-6">
      <input type="hidden" name="windows" value={JSON.stringify(windows)} />
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-bold text-ink-soft">Start from:</span>
        {PRESETS.map((preset) => (
          <Button key={preset.label} variant="secondary" size="sm" onClick={() => setWindows(preset.build())}>
            {preset.label}
          </Button>
        ))}
        <Button variant="quiet" className="text-sm" onClick={() => setWindows([])}>
          Clear all
        </Button>
      </div>

      <ul className="border-t border-rule">
        {WEEK_ORDER.map((day) => {
          const entries = windows.map((w, index) => ({ w, index })).filter(({ w }) => w.weekday === day);
          return (
            <li key={day} className="grid grid-cols-1 gap-3 border-b border-rule py-4 sm:grid-cols-[8rem_1fr]">
              <p className="pt-1.5 text-base font-bold text-ink">{WEEKDAY_NAMES[day]}</p>
              <div className="space-y-2">
                {entries.length === 0 ? <p className="pt-1.5 text-sm text-muted">Not teaching</p> : null}
                {entries.map(({ w, index }) => (
                  <div key={index} className="flex flex-wrap items-center gap-2">
                    <TimeSelect label={`${WEEKDAY_NAMES[day]} start`} value={w.startMinute} min={0} max={1410} onChange={(v) => update(index, { startMinute: v, endMinute: Math.max(w.endMinute, v + 30) })} />
                    <span className="text-sm text-muted">to</span>
                    <TimeSelect label={`${WEEKDAY_NAMES[day]} end`} value={w.endMinute} min={w.startMinute + 30} max={1440} onChange={(v) => update(index, { endMinute: v })} />
                    <Button variant="quiet" className="text-sm" onClick={() => remove(index)} aria-label={`Remove ${WEEKDAY_NAMES[day]} ${minutesToClock(w.startMinute)} to ${minutesToClock(w.endMinute)}`}>
                      Remove
                    </Button>
                  </div>
                ))}
                {entries.length < MAX_PER_DAY ? (
                  <Button variant="quiet" className="text-sm" onClick={() => add(day)}>
                    Add a time range
                  </Button>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>

      <p className="text-sm text-muted">Times are in your time zone ({timeZone.replace(/_/g, " ")}). Change it on your profile if that&rsquo;s wrong.</p>
      <FormMessage state={state} />
      {state?.errors?.windows?.[0] ? <p className="text-sm font-bold text-danger">{state.errors.windows[0]}</p> : null}
      <SubmitButton pendingLabel="Saving…">Save availability</SubmitButton>
    </form>
  );
}
