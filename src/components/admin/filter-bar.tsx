import Link from "next/link";
import { Button } from "@/components/ui/button";

type Select = { name: string; label: string; value?: string; options: { value: string; label: string }[] };

const CONTROL = "block w-full rounded-control border border-rule bg-sheet px-3 py-2 text-base text-ink";

/** One row of GET filters above a list. Works without JavaScript. */
export function FilterBar({ action, q, selects, placeholder }: { action: string; q?: string; selects: Select[]; placeholder: string }) {
  const active = Boolean(q) || selects.some((s) => s.value);
  return (
    <form role="search" action={action} className="mb-6 flex flex-wrap items-end gap-3">
      <div className="min-w-[14rem] flex-1">
        <label htmlFor="filter-q" className="mb-1 block text-sm font-bold text-ink-soft">
          Search
        </label>
        <input id="filter-q" name="q" type="search" defaultValue={q} placeholder={placeholder} className={CONTROL} />
      </div>
      {selects.map((s) => (
        <div key={s.name} className="w-44">
          <label htmlFor={`filter-${s.name}`} className="mb-1 block text-sm font-bold text-ink-soft">
            {s.label}
          </label>
          <select id={`filter-${s.name}`} name={s.name} defaultValue={s.value ?? ""} className={CONTROL}>
            <option value="">All</option>
            {s.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      ))}
      <Button type="submit" variant="secondary" size="sm" className="py-2.5">
        Apply
      </Button>
      {active ? (
        <Link href={action} className="py-2 text-sm font-bold text-ink-soft underline decoration-rule underline-offset-4">
          Clear
        </Link>
      ) : null}
    </form>
  );
}
