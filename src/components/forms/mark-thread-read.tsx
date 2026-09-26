"use client";

import { useEffect, useRef } from "react";
import { markThreadReadAction } from "@/server/actions/tutoring";

/** Marks the conversation as read once it has actually been opened (not on prefetch). */
export function MarkThreadRead({ connectionId }: { connectionId: string }) {
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    void markThreadReadAction(connectionId);
  }, [connectionId]);
  return null;
}
