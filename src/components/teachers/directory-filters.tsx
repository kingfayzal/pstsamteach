import Link from "next/link";
import { Button } from "@/components/ui/button";
import { LANGUAGES } from "@/lib/languages";
import { TIME_BANDS } from "@/lib/scheduling";
import { DIRECTORY_SORTS, type DirectoryFilters, WEEK_ORDER, WEEKDAY_NAMES } from "@/lib/teacher-directory";

type Subject = { id: string; name: string; slug: string; topics: { id: string; name: string; slug: string }[] };

const CONTROL = "block w-full rounded-control border border-rule bg-sheet px-3 py-2 text-base text-ink";

function Select({ name, label, value, children }: { name: string; label: string; value?: string | number; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <label htmlFor={`f-${name}`} className="mb-1 block text-sm font-bold text-ink-soft">
        {label}
      </label>
      <select id={`f-${name}`} name={name} defaultValue={value === undefined ? "" : String(value)} className={CONTROL}>
        {children}
      </select>
    </div>
  );
}

/** One row of GET filters. Works without JavaScript; the URL is shareable. */
export function DirectoryFilterBar({ filters, subjects, showSaved }: { filters: DirectoryFilters; subjects: Subject[]; showSaved: boolean }) {
  const active =
    filters.subject || filters.topic || filters.language || filters.weekday !== undefined || filters.band || filters.q || filters.accepting || filters.saved;
  return (
    <form role="search" action="/teachers" className="space-y-4 border-y border-rule py-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <Select name="subject" label="Subject" value={filters.subject}>
          <option value="">Any subject</option>
          {subjects.map((s) => (
            <option key={s.id} value={s.slug}>
              {s.name}
            </option>
          ))}
        </Select>
        <Select name="topic" label="Topic" value={filters.topic}>
          <option value="">Any topic</option>
          {subjects.map((s) => (
            <optgroup key={s.id} label={s.name}>
              {s.topics.map((t) => (
                <option key={t.id} value={t.slug}>
                  {t.name}
                </option>
              ))}
            </optgroup>
          ))}
        </Select>
        <Select name="language" label="Teaches in" value={filters.language}>
          <option value="">Any language</option>
          {LANGUAGES.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </Select>
        <Select name="day" label="Day" value={filters.weekday}>
          <option value="">Any day</option>
          {WEEK_ORDER.map((d) => (
            <option key={d} value={d}>
              {WEEKDAY_NAMES[d]}
            </option>
          ))}
        </Select>
        <Select name="time" label="Time of day" value={filters.band}>
          <option value="">Any time</option>
          {TIME_BANDS.map((b) => (
            <option key={b.key} value={b.key}>
              {b.label} ({b.hours})
            </option>
          ))}
        </Select>
        <Select name="sort" label="Sort by" value={filters.sort}>
          {DIRECTORY_SORTS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </Select>
      </div>
      <div className="flex flex-wrap items-end gap-x-5 gap-y-3">
        <div className="min-w-[14rem] flex-1">
          <label htmlFor="f-q" className="mb-1 block text-sm font-bold text-ink-soft">
            Search
          </label>
          <input id="f-q" name="q" type="search" defaultValue={filters.q} placeholder="Name or keyword, e.g. exam" className={CONTROL} />
        </div>
        <label className="flex items-center gap-2 py-2 text-base text-ink">
          <input type="checkbox" name="accepting" value="1" defaultChecked={filters.accepting} className="h-4 w-4 accent-ink" />
          Taking new students
        </label>
        {showSaved ? (
          <label className="flex items-center gap-2 py-2 text-base text-ink">
            <input type="checkbox" name="saved" value="1" defaultChecked={filters.saved} className="h-4 w-4 accent-ink" />
            My shortlist
          </label>
        ) : null}
        <Button type="submit" size="sm" className="py-2.5">
          Show teachers
        </Button>
        {active ? (
          <Link href="/teachers" className="py-2 text-sm font-bold text-ink-soft underline decoration-rule underline-offset-4">
            Clear filters
          </Link>
        ) : null}
      </div>
    </form>
  );
}
