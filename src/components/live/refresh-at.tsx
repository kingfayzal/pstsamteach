"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Timers further out than this are skipped: people don't keep a tab open for days. */
const MAX_WAIT_MS = 24 * 60 * 60 * 1000;

/**
 * Re-renders the page when a moment arrives, such as the room opening. The
 * server works out how long that is, so a phone whose clock is wrong still opens on time.
 */
export function RefreshAt({ inMs }: { inMs: number }) {
  const router = useRouter();
  useEffect(() => {
    if (inMs > MAX_WAIT_MS) return;
    const timer = setTimeout(() => router.refresh(), Math.max(inMs, 0) + 1000);
    return () => clearTimeout(timer);
  }, [inMs, router]);
  return null;
}
