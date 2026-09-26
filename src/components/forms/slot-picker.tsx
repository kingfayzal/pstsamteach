export type SlotGroup = { key: string; label: string; slots: { value: string; label: string }[] };

type Props = {
  groups: SlotGroup[];
  name?: string;
  selected?: string;
  optional?: boolean;
  error?: string;
};

/** Open session times grouped by day, as radio chips. Labels are pre-formatted in the viewer's zone. */
export function SlotPicker({ groups, name = "slotStart", selected, optional = false, error }: Props) {
  if (groups.length === 0) {
    return <p className="border border-dashed border-rule bg-sheet/60 px-4 py-5 text-base text-muted">No open times in the next two weeks.</p>;
  }
  return (
    <div className="space-y-4">
      {optional ? (
        <label className="flex w-fit cursor-pointer items-center gap-2 rounded-control border border-rule bg-sheet px-3 py-2 text-base text-ink has-checked:border-ink has-checked:shadow-[inset_3px_0_0_var(--color-ink)]">
          <input type="radio" name={name} value="" defaultChecked={!selected} className="h-4 w-4 accent-ink" />
          Decide the time later
        </label>
      ) : null}
      <div className="relative flex gap-4 overflow-x-auto pb-2">
        {groups.map((group) => (
          <fieldset key={group.key} className="w-32 shrink-0">
            <legend className="mb-2 text-sm font-bold text-ink">{group.label}</legend>
            <div className="space-y-1.5">
              {group.slots.map((slot) => (
                <label
                  key={slot.value}
                  className="figures flex cursor-pointer items-center justify-center rounded-control border border-rule bg-sheet px-2 py-1.5 text-base text-ink has-checked:border-ink has-checked:bg-ink has-checked:text-paper has-focus-visible:outline-3 has-focus-visible:outline-focus"
                >
                  <input type="radio" name={name} value={slot.value} defaultChecked={selected === slot.value} className="sr-only" />
                  {slot.label}
                </label>
              ))}
            </div>
          </fieldset>
        ))}
      </div>
      {error ? <p className="text-sm font-bold text-danger">{error}</p> : null}
    </div>
  );
}
