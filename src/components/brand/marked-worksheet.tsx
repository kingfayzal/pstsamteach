import type { CSSProperties, ReactNode } from "react";

/**
 * The landing page's one orchestrated moment: a homework sheet with one
 * question from each subject, marked in green pen as the page loads.
 * Pure CSS animation; reduced-motion users see the finished marking.
 */

const delay = (seconds: number, length?: number) => ({ "--delay": `${seconds}s`, ...(length ? { "--len": length } : {}) }) as CSSProperties;

function MarginLabel({ children, color }: { children: ReactNode; color: string }) {
  return (
    <span className="absolute top-0 -left-[4.1rem] w-[3.1rem] pr-1.5 text-right text-xs leading-8 font-extrabold" style={{ color }}>
      {children}
    </span>
  );
}

function PenTick({ at, className = "" }: { at: number; className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 34 28" className={`h-7 w-8 text-tick ${className}`} fill="none">
      <path
        className="pen-draw"
        style={delay(at, 48)}
        d="M3 15.5c2.6 1.6 5.4 4.7 7.1 8.5C15.2 14.2 22 6.6 31 2.5"
        stroke="currentColor"
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function MarkedWorksheet() {
  return (
    <figure
      aria-label="A homework sheet with one question each from Maths, English and Nursing, marked by a teacher in green pen. Two answers are ticked, one word is corrected, and the score is 2 out of 3."
      className="relative mx-auto w-full max-w-[34rem] rotate-[-1.2deg] shadow-lift"
    >
      <div className="ruled relative pt-8 pr-5 pb-8 pl-[4.1rem] text-base leading-8 text-ink sm:pr-8">
        <div className="flex items-baseline justify-between">
          <span className="font-extrabold">Homework, week 3</span>
          <span className="text-sm text-muted">Ada O.</span>
        </div>

        <div className="relative mt-8">
          <MarginLabel color="var(--color-maths)">Maths</MarginLabel>
          <p>
            <span className="font-bold">1.</span> Solve 3x + 5 = 20
          </p>
          <p className="flex items-center gap-3 pl-5">
            <span className="figures">3x = 15, so x = 5</span>
            <PenTick at={0.6} />
          </p>
        </div>

        <div className="relative mt-8">
          <MarginLabel color="var(--color-english)">English</MarginLabel>
          <p>
            <span className="font-bold">2.</span> Correct the sentence.
          </p>
          <p className="mt-8 pl-5">
            <span className="relative inline-block">
              <span className="hand pen-write absolute -top-[1.35rem] left-0 text-lg whitespace-nowrap text-tick-text" style={delay(1.55)}>
                They&rsquo;re
              </span>
              Their
              <svg aria-hidden="true" viewBox="0 0 60 12" preserveAspectRatio="none" className="absolute top-1/2 left-[-3px] h-3 w-[calc(100%+6px)] -translate-y-1/2 text-tick" fill="none">
                <path className="pen-draw" style={delay(1.2, 64)} d="M2 8C18 5 38 7 58 3" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
              </svg>
            </span>{" "}
            going to the market.
          </p>
        </div>

        <div className="relative mt-8">
          <MarginLabel color="var(--color-nursing)">Nursing</MarginLabel>
          <p>
            <span className="font-bold">3.</span> Ordered 250 mg. Stock is 125 mg in 5 mL.
          </p>
          <p className="flex items-center gap-3 pl-5">
            <span className="figures">250 &divide; 125 &times; 5 = 10 mL</span>
            <PenTick at={2.0} />
          </p>
        </div>

        <div className="relative mt-8 flex items-center justify-end gap-4">
          <span className="hand pen-write text-lg leading-tight text-tick-text" style={delay(3.0)}>
            Good work. Watch your homophones!
          </span>
          <span className="relative inline-flex h-14 w-20 shrink-0 items-center justify-center">
            <svg aria-hidden="true" viewBox="0 0 100 64" className="absolute inset-0 h-full w-full text-tick" fill="none">
              <path
                className="pen-draw"
                style={delay(2.5, 260)}
                d="M54 5C25 4 5 15 5 33s21 27 48 26c27-1 43-12 43-28C96 13 75 5 44 7"
                stroke="currentColor"
                strokeWidth="2.8"
                strokeLinecap="round"
              />
            </svg>
            <span className="hand pen-write figures relative text-2xl text-tick-text" style={delay(2.75)}>
              2/3
            </span>
          </span>
        </div>
      </div>
    </figure>
  );
}
