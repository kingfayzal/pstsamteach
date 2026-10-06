import "server-only";
import { after } from "next/server";
import { appOrigin, parseEmailConfig } from "@/lib/email/config";
import { deliverDueEmails } from "./outbox";
import { createLogTransport, createResendTransport, type EmailTransport } from "./transport";

export { enqueueEmail } from "./outbox";
export type { EmailTransport } from "./transport";

let cached: EmailTransport | undefined;

/** Resend when it's configured, otherwise the log stand-in (see transport.ts). */
export function getEmailTransport(): EmailTransport {
  if (!cached) {
    const config = parseEmailConfig(process.env);
    cached = config ? createResendTransport(config) : createLogTransport();
  }
  return cached;
}

/**
 * Send queued email once the response has gone out, so nobody waits on the email
 * service. Call it from a server action after the change has committed. Anything
 * that fails stays queued for the next sender or the daily job (api/cron/emails).
 */
export function sendQueuedEmails(): void {
  after(async () => {
    try {
      await deliverDueEmails(getEmailTransport());
    } catch (error) {
      console.error("[email] Sending queued email failed; it stays queued.", error);
    }
  });
}

/** An absolute link to a page on this deployment, for use in an email. */
export function absoluteUrl(path: string, params: Record<string, string> = {}): string {
  const url = new URL(path, appOrigin(process.env));
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return url.toString();
}
