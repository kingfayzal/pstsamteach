import { createHash, timingSafeEqual } from "node:crypto";
import { getEmailTransport } from "@/server/email";
import { deliverDueEmails, pruneEmailRecords } from "@/server/email/outbox";

/** Sending can take a while when a backlog has built up. */
export const maxDuration = 60;

function authorized(header: string | null, secret: string | undefined): boolean {
  if (!secret || !header) return false;
  // Compare digests so the check takes the same time whatever the header holds.
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(header), digest(`Bearer ${secret}`));
}

/**
 * The daily email job (vercel.json). Email normally goes out straight after the
 * action that queued it; this picks up anything that failed and is due a retry,
 * then clears out expired links and old sent mail. Vercel signs the call with
 * CRON_SECRET, and without that secret set the job refuses to run.
 */
export async function GET(request: Request): Promise<Response> {
  if (!authorized(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return new Response("Unauthorized", { status: 401 });
  }
  const delivered = await deliverDueEmails(getEmailTransport(), { limit: 200 });
  const pruned = await pruneEmailRecords();
  return Response.json({ delivered, pruned });
}
