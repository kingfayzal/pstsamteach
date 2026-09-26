import Link from "next/link";
import { SITE } from "@/lib/site";

/** The name, signed off with a teacher's tick. */
export function Wordmark({ href = "/", className = "" }: { href?: string; className?: string }) {
  return (
    <Link href={href} className={`group inline-flex items-end gap-1 text-ink ${className}`} aria-label={`${SITE.name} home`}>
      <span className="text-2xl leading-none font-extrabold tracking-[-0.035em]">{SITE.name}</span>
      <svg aria-hidden="true" viewBox="0 0 28 24" className="mb-1 h-4 w-5 text-tick" fill="none">
        <path d="M2.5 13.2c2.3 1.4 4.6 4 6 7.3C12.8 12.1 18.6 5.6 25.5 2" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </Link>
  );
}
