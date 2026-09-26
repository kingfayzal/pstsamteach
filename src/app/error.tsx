"use client";

import { Button } from "@/components/ui/button";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-24 sm:px-8">
      <div className="max-w-xl space-y-5">
        <h1 className="text-4xl text-ink">Something went wrong on our side.</h1>
        <p className="text-lg text-ink-soft">
          Your work hasn&rsquo;t been lost. Try again, and if it keeps happening, tell the platform team
          {error.digest ? (
            <>
              {" "}
              and quote reference <span className="figures font-bold text-ink">{error.digest}</span>
            </>
          ) : null}
          .
        </p>
        <Button onClick={reset}>Try again</Button>
      </div>
    </div>
  );
}
