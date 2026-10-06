import Link from "next/link";
import { SITE } from "@/lib/site";

/** The Xcel Study mark: a bookmark holding a star, in the brand's navy and blue. */
export function BrandMark({ className = "" }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 200 190" className={className} fill="none">
      <path
        d="M79 30H33c-8 0-14 6-14 14v118c0 8 7 13 14 9l67-37 67 37c7 4 14-1 14-9V44c0-8-6-14-14-14h-46"
        stroke="var(--color-brand-navy)"
        strokeWidth="14"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M100 12l17 38 42 5-31 28 8 42-36-21-36 21 8-42-31-28 42-5z"
        fill="var(--color-brand)"
        stroke="var(--color-brand)"
        strokeWidth="4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * The mark and the name. `reload` makes it a full page load, for pages such as
 * video rooms whose browser permissions shouldn't carry over to the next page.
 */
export function Wordmark({ href = "/", className = "", reload = false }: { href?: string; className?: string; reload?: boolean }) {
  const classes = `inline-flex items-center gap-2 text-ink ${className}`;
  const content = (
    <>
      <BrandMark className="h-7 w-auto shrink-0" />
      <span className="text-2xl leading-none font-extrabold tracking-[-0.035em]">{SITE.name}</span>
    </>
  );
  return reload ? (
    <a href={href} className={classes} aria-label={`${SITE.name} home`}>
      {content}
    </a>
  ) : (
    <Link href={href} className={classes} aria-label={`${SITE.name} home`}>
      {content}
    </Link>
  );
}
