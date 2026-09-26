import { TIME_BANDS, type Timetable } from "@/lib/scheduling";
import { WEEK_ORDER, WEEKDAY_NAMES } from "@/lib/teacher-directory";

/**
 * Weekly availability as a school timetable: days across, times of day down,
 * filled cells where the teacher teaches. Always in the viewer's time zone.
 */
export function AvailabilityTimetable({ table, timeZone }: { table: Timetable; timeZone: string }) {
  return (
    <figure className="space-y-2">
      <div className="relative overflow-x-auto">
        <table className="w-full min-w-[30rem] table-fixed border-collapse text-center">
          <thead>
            <tr>
              <td className="w-24" />
              {WEEK_ORDER.map((day) => (
                <th key={day} scope="col" className="pb-2 text-sm font-bold text-ink-soft">
                  <abbr title={WEEKDAY_NAMES[day]} className="no-underline">
                    {WEEKDAY_NAMES[day].slice(0, 3)}
                  </abbr>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {TIME_BANDS.map((band) => (
              <tr key={band.key}>
                <th scope="row" className="py-1 pr-3 text-left text-sm font-bold text-ink">
                  {band.label}
                  <span className="figures block text-xs font-normal text-muted">{band.hours}</span>
                </th>
                {WEEK_ORDER.map((day) => {
                  const on = table[day][band.key];
                  return (
                    <td key={day} className="p-1">
                      <span className={`block h-9 rounded-[3px] border ${on ? "border-ink bg-ink" : "border-rule bg-sheet"}`}>
                        <span className="sr-only">{on ? "Available" : "Not available"}</span>
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <figcaption className="text-sm text-muted">Shown in your time zone ({timeZone.replace(/_/g, " ")}).</figcaption>
    </figure>
  );
}
