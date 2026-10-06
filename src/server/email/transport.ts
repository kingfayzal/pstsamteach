import "server-only";
import { Resend } from "resend";
import type { EmailConfig } from "@/lib/email/config";
import { isRetryableResendError } from "@/lib/email/delivery";
import { SITE } from "@/lib/site";

/**
 * The seam between Xcel Study and its email service (ADR-0002). The outbox only
 * uses this interface, so changing provider changes one file.
 */

export type OutgoingEmail = {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Sending the same key twice within a day sends one email (Resend keeps it 24 hours). */
  idempotencyKey: string;
  kind: string;
};

export type SendResult = { ok: true; id: string } | { ok: false; retryable: boolean; error: string };

export interface EmailTransport {
  /** True when the email really reaches an inbox; false for the log stand-in. */
  readonly delivers: boolean;
  send(email: OutgoingEmail): Promise<SendResult>;
}

export function createResendTransport(config: EmailConfig, client = new Resend(config.apiKey)): EmailTransport {
  return {
    delivers: true,
    async send(email) {
      const { data, error } = await client.emails.send(
        {
          from: config.from,
          to: email.to,
          replyTo: config.replyTo ?? SITE.supportEmail,
          subject: email.subject,
          html: email.html,
          text: email.text,
          tags: [{ name: "kind", value: email.kind }],
        },
        { idempotencyKey: email.idempotencyKey },
      );
      if (error) return { ok: false, retryable: isRetryableResendError(error.name), error: `${error.name}: ${error.message}` };
      return { ok: true, id: data.id };
    },
  };
}

/**
 * Used when email isn't configured (local development, E2E, a preview without a
 * key). The message goes to the server log instead, so a developer can follow
 * the links. Production never shows the content: those links sign people in.
 */
export function createLogTransport(env: Record<string, string | undefined> = process.env): EmailTransport {
  const showContent = env.VERCEL_ENV !== "production";
  return {
    delivers: false,
    async send(email) {
      if (showContent) console.info(`[email] To: ${email.to}\n[email] Subject: ${email.subject}\n\n${email.text}`);
      else console.warn(`[email] Not sent to ${email.to} (${email.kind}): email isn't configured.`);
      return { ok: true, id: `log-${email.idempotencyKey}` };
    },
  };
}
