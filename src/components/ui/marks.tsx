import { toPercent } from "@/lib/grading";

/** A teacher's tick, drawn rather than set in type. */
export function Tick({ className = "h-5 w-5", title }: { className?: string; title?: string }) {
  return (
    <svg viewBox="0 0 28 24" className={`text-tick ${className}`} fill="none" role={title ? "img" : undefined} aria-hidden={title ? undefined : true}>
      {title ? <title>{title}</title> : null}
      <path d="M2.5 13.2c2.3 1.4 4.6 4 6 7.3C12.8 12.1 18.6 5.6 25.5 2" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Score circled in pen, the way work comes back from a teacher. */
export function CircledScore({ score, maxScore, passPercent, size = "md" }: { score: number; maxScore: number; passPercent: number; size?: "sm" | "md" | "lg" }) {
  const passed = toPercent(score, maxScore) >= passPercent;
  const dims = { sm: "h-11 min-w-16 text-lg", md: "h-14 min-w-20 text-2xl", lg: "h-20 min-w-28 text-3xl" }[size];
  return (
    <span
      className={`hand figures relative inline-flex items-center justify-center px-3 ${dims} ${passed ? "text-tick-text" : "text-danger"}`}
      aria-label={`${score} out of ${maxScore}, ${passed ? "passed" : "not yet passed"}`}
    >
      <svg aria-hidden="true" viewBox="0 0 100 60" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" fill="none">
        <path
          d="M52 4C24 3 5 14 5 31s20 26 47 25c26-1 43-11 43-27C95 12 74 4 44 6"
          stroke="currentColor"
          strokeWidth="2.6"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <span className="relative">
        {score}/{maxScore}
      </span>
    </span>
  );
}

/** Handwritten feedback in the margin. Only ever used for a teacher's own words. */
export function TeacherNote({ children, author }: { children: React.ReactNode; author?: string }) {
  return (
    <figure className="border-l-2 border-margin pl-4">
      <blockquote className="hand text-xl leading-snug text-ink-soft">{children}</blockquote>
      {author ? <figcaption className="mt-1 text-sm text-muted">{author}</figcaption> : null}
    </figure>
  );
}

/** Progress as a line of ink across the ruled line. */
export function InkProgress({ percent, label }: { percent: number; label: string }) {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <div className="flex items-center gap-3">
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={clamped}
        className="relative h-2 flex-1 overflow-hidden rounded-full bg-rule-soft"
      >
        <div className={`h-full rounded-full ${clamped === 100 ? "bg-tick" : "bg-ink"}`} style={{ width: `${clamped}%` }} />
      </div>
      <span className="figures w-11 text-right text-sm font-bold text-ink-soft">{clamped}%</span>
    </div>
  );
}
