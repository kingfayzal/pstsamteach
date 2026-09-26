import { noticeFor } from "@/lib/notices";
import { Tick } from "./marks";

/** Renders a whitelisted confirmation from the ?notice= query parameter. */
export function Notice({ value }: { value: unknown }) {
  const message = noticeFor(value);
  if (!message) return null;
  return (
    <p role="status" className="mb-6 flex items-start gap-3 border border-tick/30 bg-tick-wash px-4 py-3 text-base font-bold text-tick-text">
      <Tick className="mt-0.5 h-5 w-5 shrink-0" />
      {message}
    </p>
  );
}
