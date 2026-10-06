# ADR-0002: Use Resend for transactional email

**Date**: 2026-10-04
**Status**: accepted
**Deciders**: Fayzal (owner), Claude (analysis)

## Context

Xcel Study sent no email. Nobody could reset a forgotten password, sign-ups never
proved they owned their address, and every event (a teacher's decision, a booking, a
cancellation) was an in-app badge only. The owner wants every event that deserves an
email to have one, most important first, starting with account emails.

Constraints: the app runs on Vercel serverless functions (no long-lived worker), on
Supabase Postgres, with its own session auth (so Supabase Auth's emails don't apply).
The Vercel Hobby plan runs cron jobs at most once a day. Sessions are booked up to 14
days ahead and will need reminders. Pricing isn't decided, so cost has to stay low.

## Options

| | Free tier | First paid plan | Scheduled sends | Notes |
| --- | --- | --- | --- | --- |
| **Resend** | 3,000/month, 100/day | $20 for 50,000 | Up to 30 days ahead, cancellable | HTTP API, small Node SDK, idempotency keys, webhooks |
| Postmark | 100/month | $15 for 10,000 | No | Excellent transactional deliverability; free tier too small to run staging |
| Amazon SES | Pay per email | Cheapest at volume | No | More setup (IAM, sandbox exit), no templates; revisit at large volume |
| SendGrid | None | Higher | Yes | Heavier product, no free tier |
| Supabase Auth emails | n/a | n/a | n/a | Only for Supabase Auth, which we don't use |

## Decision

We send through Resend, from a domain we verify there. All of it sits behind a small
`EmailTransport` adapter (`src/server/email/transport.ts`), so changing provider
changes one file.

- **Outbox.** Services queue an email (`enqueueEmail`) in the same transaction as the
  change it reports, into an `EmailOutbox` table. If the change rolls back, no email
  exists; if Resend is down, nothing is lost.
- **Sending.** Actions call `sendQueuedEmails()`, which uses Next's `after()` to send
  due email once the response has gone out. Senders claim rows with `FOR UPDATE SKIP
  LOCKED` and a two-minute lease, so several can run at once, and each send carries an
  idempotency key (`email-<row id>`) so a retry after a timeout can't double-send.
- **Retries.** Temporary failures (rate limits, quota, Resend errors, a bad key) back
  off 1 min, 5 min, 30 min, 2 h, 12 h, then fail. Bad requests fail at once. Any later
  send picks up due retries, and a daily cron (`/api/cron/emails`, signed with
  `CRON_SECRET`) sweeps the rest and prunes expired links. That suits the Hobby plan's
  once-a-day cron.
- **Templates are data.** Each email is a typed message validated by Zod
  (`src/lib/email/templates.ts`); one layout renders HTML and plain text with every
  value escaped. No React Email: its component package is deprecated, Next.js keeps
  `react-dom/server` out of server components, and a data model is easier to test.
- **Links.** Confirmation and reset tokens are 32 random bytes stored as SHA-256 hashes
  (`AccountToken`), tied to the address they went to, single use. Link origins come
  from `APP_URL` or Vercel's own variables, never the Host header. Once an email holding
  such a link has really been sent, its stored payload is emptied.
- **Without Resend.** Locally, in E2E and on a preview without a key, a log transport
  prints the email (links included) instead of sending it. Production refuses to build
  without `RESEND_API_KEY` and `EMAIL_FROM`, and never prints email content.
- **Confirmed addresses.** New accounts must confirm their address before requesting a
  teacher, booking or messaging. Accounts that existed before this change were marked
  confirmed by the migration, so nobody was locked out of an existing partnership.
  (2026-10-06: tightened. Every role now confirms before using any signed-in page; see
  docs/PLAN.md, Phase 4, Rules.)

## Consequences

- Session reminders (the next batch) can be handed to Resend's scheduled sending at
  booking time and cancelled with the session, instead of needing a frequent cron.
- The free plan's 100-a-day cap will be reached at roughly 15–20 bookings a day once
  session emails exist; move to Pro before then.
- Email content and links also live in Resend's logs for its retention period.
- Bounces and complaints are suppressed by Resend itself; reacting to them in the app
  (webhooks) is left for later.
