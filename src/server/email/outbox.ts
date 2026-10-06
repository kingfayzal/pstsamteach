import "server-only";
import { retryDelayMs } from "@/lib/email/delivery";
import { toHtml, toText } from "@/lib/email/layout";
import { type EmailMessage, isSensitiveKind, parseEmailMessage, renderEmail } from "@/lib/email/templates";
import { db, type Db, type Tx } from "@/server/db";
import type { EmailTransport, SendResult } from "./transport";

const LEASE_MS = 2 * 60 * 1000;
const DAY = 24 * 60 * 60 * 1000;

export type QueuedEmail = {
  to: string;
  userId?: string | null;
  message: EmailMessage;
  /** Drop it rather than send it after this, e.g. when the link inside expires. */
  expiresAt?: Date | null;
  /** When it's queued (and due). Defaults to the database's clock. */
  now?: Date;
};

/**
 * Queue an email inside the caller's transaction, so it exists exactly when the
 * change it reports does. Nothing is sent here: call sendQueuedEmails() from the
 * action once the change has committed.
 */
export async function enqueueEmail(client: Db | Tx, email: QueuedEmail): Promise<{ id: string }> {
  const checked = parseEmailMessage(email.message.kind, email.message.data);
  // A template mistake should fail the change that caused it, not surface later in the sender.
  if (!checked) throw new Error(`The "${email.message.kind}" email was queued with data its template doesn't accept.`);
  return client.emailOutbox.create({
    data: {
      kind: checked.kind,
      toEmail: email.to,
      userId: email.userId ?? null,
      payload: checked.data,
      expiresAt: email.expiresAt ?? null,
      ...(email.now ? { sendAfter: email.now, createdAt: email.now } : {}),
    },
    select: { id: true },
  });
}

type ClaimedRow = { id: string; kind: string; toEmail: string; payload: unknown; attempts: number; expiresAt: Date | null };

/**
 * Take up to `limit` due emails for this sender. SKIP LOCKED lets two senders run
 * at once without sharing rows, and the lease hands back a row whose sender died.
 */
async function claimDue(now: Date, limit: number): Promise<ClaimedRow[]> {
  const lease = new Date(now.getTime() + LEASE_MS);
  return db.$queryRaw<ClaimedRow[]>`
    UPDATE "EmailOutbox"
    SET "status" = 'SENDING', "lockedUntil" = ${lease}, "attempts" = "attempts" + 1, "updatedAt" = ${now}
    WHERE "id" IN (
      SELECT "id" FROM "EmailOutbox"
      WHERE ("status" = 'PENDING' AND "sendAfter" <= ${now}) OR ("status" = 'SENDING' AND "lockedUntil" <= ${now})
      ORDER BY "sendAfter" ASC, "createdAt" ASC, "id" ASC
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING "id", "kind", "toEmail", "payload", "attempts", "expiresAt"`;
}

async function attempt(transport: EmailTransport, row: ClaimedRow, message: EmailMessage): Promise<SendResult> {
  const content = renderEmail(message);
  try {
    return await transport.send({
      to: row.toEmail,
      subject: content.subject,
      html: toHtml(content),
      text: toText(content),
      idempotencyKey: `email-${row.id}`,
      kind: row.kind,
    });
  } catch (error) {
    // A network failure or a thrown SDK error: worth another go.
    return { ok: false, retryable: true, error: error instanceof Error ? error.message : String(error) };
  }
}

export type DeliveryReport = { sent: number; retrying: number; failed: number; expired: number };

type Outcome = keyof DeliveryReport;

async function deliverOne(transport: EmailTransport, row: ClaimedRow, now: Date): Promise<Outcome> {
  if (row.expiresAt && row.expiresAt <= now) {
    await db.emailOutbox.update({ where: { id: row.id }, data: { status: "CANCELLED", payload: {}, lockedUntil: null, lastError: "Expired before it could be sent." } });
    return "expired";
  }
  const message = parseEmailMessage(row.kind, row.payload);
  if (!message) {
    await db.emailOutbox.update({ where: { id: row.id }, data: { status: "FAILED", lockedUntil: null, lastError: "Its data no longer matches the template." } });
    return "failed";
  }

  const result = await attempt(transport, row, message);
  if (result.ok) {
    await db.emailOutbox.update({
      where: { id: row.id },
      data: {
        status: "SENT",
        sentAt: now,
        providerId: result.id,
        lockedUntil: null,
        lastError: null,
        // A link that signs someone in shouldn't outlive its email in our database.
        ...(transport.delivers && isSensitiveKind(row.kind) ? { payload: {} } : {}),
      },
    });
    return "sent";
  }

  const delay = result.retryable ? retryDelayMs(row.attempts) : null;
  const error = result.error.slice(0, 500);
  if (delay === null) {
    await db.emailOutbox.update({
      where: { id: row.id },
      data: { status: "FAILED", lockedUntil: null, lastError: error, ...(isSensitiveKind(row.kind) ? { payload: {} } : {}) },
    });
    console.error(`[email] Gave up on ${row.kind} email ${row.id}: ${error}`);
    return "failed";
  }
  await db.emailOutbox.update({
    where: { id: row.id },
    data: { status: "PENDING", sendAfter: new Date(now.getTime() + delay), lockedUntil: null, lastError: error },
  });
  return "retrying";
}

/** Send whatever is due, oldest first. Safe to run from several places at once. */
export async function deliverDueEmails(transport: EmailTransport, options: { now?: Date; limit?: number } = {}): Promise<DeliveryReport> {
  const now = options.now ?? new Date();
  const report: DeliveryReport = { sent: 0, retrying: 0, failed: 0, expired: 0 };
  for (const row of await claimDue(now, options.limit ?? 20)) report[await deliverOne(transport, row, now)]++;
  return report;
}

/** Housekeeping for the daily job: used and expired links, and old finished email. */
export async function pruneEmailRecords(now = new Date()): Promise<{ tokens: number; emails: number }> {
  const [tokens, emails] = await Promise.all([
    db.accountToken.deleteMany({ where: { expiresAt: { lt: new Date(now.getTime() - DAY) } } }),
    db.emailOutbox.deleteMany({ where: { status: { in: ["SENT", "FAILED", "CANCELLED"] }, updatedAt: { lt: new Date(now.getTime() - 90 * DAY) } } }),
  ]);
  return { tokens: tokens.count, emails: emails.count };
}
