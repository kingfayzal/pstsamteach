const STAR = "M10 1.6l2.47 5.2 5.66.72-4.15 3.92 1.06 5.62L10 14.3l-5.04 2.76 1.06-5.62L1.87 7.52l5.66-.72z";

function Star({ filled, className = "h-4 w-4" }: { filled: boolean; className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className={className}>
      <path d={STAR} className={filled ? "fill-ink" : "fill-none stroke-ink-soft"} strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  );
}

/** Average rating as a single star and a number, e.g. for directory rows. */
export function RatingSummary({ average, count, size = "md" }: { average: number | null; count: number; size?: "md" | "lg" }) {
  if (average === null || count === 0) {
    return <span className="text-sm text-muted">New teacher, no reviews yet</span>;
  }
  return (
    <span className="inline-flex items-baseline gap-1.5" aria-label={`Rated ${average} out of 5 from ${count} review${count === 1 ? "" : "s"}`}>
      <Star filled className={size === "lg" ? "h-5 w-5 self-center" : "h-4 w-4 self-center"} />
      <span className={`figures font-extrabold text-ink ${size === "lg" ? "text-2xl" : "text-lg"}`}>{average.toFixed(1)}</span>
      <span className="text-sm text-muted">
        {count} review{count === 1 ? "" : "s"}
      </span>
    </span>
  );
}

/** Five stars for one review. */
export function Stars({ rating }: { rating: number }) {
  return (
    <span className="inline-flex gap-0.5" role="img" aria-label={`Rated ${rating} out of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} filled={n <= rating} className="h-3.5 w-3.5" />
      ))}
    </span>
  );
}
