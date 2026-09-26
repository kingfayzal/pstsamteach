"use client";

import { useState } from "react";
import type { DailyCount } from "@/lib/signups";

const HEIGHT = 160;
const BAR_MAX = 24;
const TOP_PAD = 20;
const AXIS_W = 28;

const dayLabel = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
const fmt = (iso: string) => dayLabel.format(new Date(`${iso}T00:00:00Z`));

function niceMax(value: number): number {
  if (value <= 4) return 4;
  const step = 10 ** Math.floor(Math.log10(value));
  return Math.ceil(value / step) * step;
}

/**
 * New student accounts per day. One series, so no legend: the heading names it.
 * Each column is hoverable and focusable; the table below carries every value.
 */
export function SignupChart({ data }: { data: DailyCount[] }) {
  const [active, setActive] = useState<number | null>(null);
  const max = niceMax(Math.max(...data.map((d) => d.students), 0));
  const slot = 100 / data.length;
  const plotH = HEIGHT - TOP_PAD;
  const current = active === null ? null : data[active];

  return (
    <figure className="space-y-3">
      <div className="relative" onPointerLeave={() => setActive(null)}>
        <div className="relative flex" style={{ height: HEIGHT }}>
          <div className="figures relative shrink-0 text-xs text-muted" style={{ width: AXIS_W }} aria-hidden="true">
            <span className="absolute right-2" style={{ top: TOP_PAD - 8 }}>
              {max}
            </span>
            <span className="absolute right-2 bottom-0 translate-y-1/2">0</span>
          </div>
          <div className="relative flex-1">
            <div className="absolute inset-x-0 border-t border-rule-soft" style={{ top: TOP_PAD }} aria-hidden="true" />
            <div className="absolute inset-x-0 bottom-0 border-t border-rule" aria-hidden="true" />
            <ul className="absolute inset-0 flex items-end" aria-label="New student accounts per day">
              {data.map((d, i) => {
                const h = d.students === 0 ? 0 : Math.max(3, (d.students / max) * plotH);
                return (
                  <li key={d.date} className="flex h-full justify-center" style={{ width: `${slot}%` }}>
                    <button
                      type="button"
                      className="group flex h-full w-full items-end justify-center focus-visible:outline-offset-0"
                      aria-label={`${fmt(d.date)}: ${d.students} new student${d.students === 1 ? "" : "s"}, ${d.teachers} teacher application${d.teachers === 1 ? "" : "s"}`}
                      onPointerEnter={() => setActive(i)}
                      onFocus={() => setActive(i)}
                      onBlur={() => setActive(null)}
                    >
                      <span
                        className={`block rounded-t-[4px] transition-colors ${active === i ? "bg-maths" : "bg-ink"}`}
                        style={{ height: h, width: `min(${BAR_MAX}px, 70%)` }}
                      />
                    </button>
                  </li>
                );
              })}
            </ul>
            {current && active !== null ? (
              <div
                role="status"
                className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-control border border-rule bg-sheet px-3 py-2 shadow-lift"
                style={{ left: `${(active + 0.5) * slot}%`, top: 0 }}
              >
                <p className="figures text-lg leading-none font-extrabold text-ink">{current.students}</p>
                <p className="mt-1 text-xs whitespace-nowrap text-muted">
                  new student{current.students === 1 ? "" : "s"}, {fmt(current.date)}
                </p>
              </div>
            ) : null}
          </div>
        </div>
        <div className="figures flex justify-between pt-2 text-xs text-muted" style={{ paddingLeft: AXIS_W }} aria-hidden="true">
          <span>{fmt(data[0]?.date ?? "")}</span>
          <span>{fmt(data.at(-1)?.date ?? "")}</span>
        </div>
      </div>
      <details className="text-sm">
        <summary className="cursor-pointer font-bold text-ink-soft underline decoration-rule underline-offset-4">Show as a table</summary>
        <table className="figures mt-3 w-full max-w-sm border-collapse text-left">
          <thead>
            <tr className="border-b border-ink text-ink-soft">
              <th scope="col" className="py-1 pr-4 font-bold">Day</th>
              <th scope="col" className="py-1 pr-4 font-bold">Students</th>
              <th scope="col" className="py-1 font-bold">Teacher applications</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.date} className="border-b border-rule">
                <td className="py-1 pr-4">{fmt(d.date)}</td>
                <td className="py-1 pr-4">{d.students}</td>
                <td className="py-1">{d.teachers}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
