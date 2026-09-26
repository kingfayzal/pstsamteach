import type { CSSProperties } from "react";
import type { CourseStatus } from "@/generated/prisma/enums";
import { STATUS_LABEL } from "@/lib/course-lifecycle";
import type { AssessmentState } from "@/server/queries/course-progress";
import { Tick } from "./marks";

const STATUS_STYLE: Record<CourseStatus, string> = {
  DRAFT: "border-rule text-ink-soft bg-sheet",
  IN_REVIEW: "border-amber/30 text-amber bg-amber-wash",
  PUBLISHED: "border-tick/30 text-tick-text bg-tick-wash",
  ARCHIVED: "border-rule text-muted bg-rule-soft",
};

export function CourseStatusBadge({ status }: { status: CourseStatus }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-sm font-bold ${STATUS_STYLE[status]}`}>
      {status === "PUBLISHED" ? <Tick className="h-3.5 w-3.5" /> : null}
      {STATUS_LABEL[status]}
    </span>
  );
}

const STATE_COPY: Record<AssessmentState, { label: string; style: string }> = {
  todo: { label: "Not started", style: "border-rule text-ink-soft bg-sheet" },
  awaiting: { label: "Waiting for marking", style: "border-amber/30 text-amber bg-amber-wash" },
  passed: { label: "Passed", style: "border-tick/30 text-tick-text bg-tick-wash" },
  retry: { label: "Try again", style: "border-danger/25 text-danger bg-danger-wash" },
};

export function AssessmentStateBadge({ state }: { state: AssessmentState }) {
  const { label, style } = STATE_COPY[state];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-sm font-bold ${style}`}>
      {state === "passed" ? <Tick className="h-3.5 w-3.5" /> : null}
      {label}
    </span>
  );
}

/** Subject colour swatch and name. The colour is the information. */
export function SubjectTag({ name, color, className = "" }: { name: string; color: string; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 text-sm font-bold text-ink-soft ${className}`} style={{ "--subject": color } as CSSProperties}>
      <span aria-hidden="true" className="h-3 w-3 rounded-[2px] bg-(--subject)" />
      {name}
    </span>
  );
}

export function Pill({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "good" | "warn" | "bad" }) {
  const style = {
    neutral: "border-rule text-ink-soft bg-sheet",
    good: "border-tick/30 text-tick-text bg-tick-wash",
    warn: "border-amber/30 text-amber bg-amber-wash",
    bad: "border-danger/25 text-danger bg-danger-wash",
  }[tone];
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-sm font-bold ${style}`}>{children}</span>;
}
