# Build plan — v1

A teaching platform with three sides: students learn, teachers publish and
mark, platform owners run it. Starting subjects: English, Mathematics, Nursing.

## Stack

| Layer | Choice | Why |
| --- | --- | --- |
| App | Next.js 16 (App Router, Server Actions, Turbopack) | One codebase for UI + server logic; actions give CSRF-safe mutations |
| Language | TypeScript (strict) | |
| Styling | Tailwind CSS 4 + CSS tokens | Design tokens live in `globals.css` |
| Data | Prisma 7 + Postgres (node-postgres adapter) | Docker Postgres in dev, Supabase in prod; serverless-friendly through Supabase's pooler |
| Validation | Zod 4 | Every form and action input is parsed at the boundary |
| Auth | Own session auth: scrypt hashes, DB sessions, httpOnly cookie | No third-party dependency; sessions revocable (suspend = instant logout) |
| Tests | Vitest (unit + integration against a real Postgres database), Playwright (E2E) | |

## Roles

- **Student** — signs up, browses the catalog, enrols, works through lessons,
  takes quizzes (auto-marked), submits assignments (teacher-marked), sees grades.
- **Teacher** — applies to teach; an admin approves. Creates courses inside a
  subject, writes lessons, builds quizzes/assignments, submits the course for
  review, marks submitted work, posts course announcements, sees their roster.
- **Admin** (platform owner) — approves teachers, reviews and publishes courses,
  features/archives courses, suspends accounts, manages subjects, posts
  platform-wide announcements, reads the activity log and platform numbers.

## Course lifecycle

```
DRAFT --submit(teacher)--> IN_REVIEW --approve(admin)--> PUBLISHED --archive(admin)--> ARCHIVED
  ^                          |                              |                           |
  +---withdraw(teacher)------+                              |                           |
  +---reject(admin, note)----+                              |                           |
  +---unpublish(admin)--------------------------------------+                           |
                                                            +<--restore(admin)----------+
```

Only PUBLISHED courses appear in the catalog and accept enrolments. Teachers
can keep editing lessons on a published course.

## Architecture

```
src/
  app/                 routes (thin: read session, call queries/actions, render)
    (public)/          landing, catalog, course pages
    (auth)/            login, signup, apply-to-teach
    learn/ teach/ admin/ account/
  components/          UI, brand, shell, course pieces
  lib/                 pure logic — grading, progress, lifecycle, validation, video, slug, format
  server/
    auth/              password, session, rate limit, current user guards
    services/          business operations: (actor, input) -> result; authz lives here
    queries/           read models for pages (authz-aware)
    actions/           'use server' wrappers: session -> service -> revalidate/redirect
  generated/prisma     Prisma client (generated, gitignored)
prisma/                schema, migrations, seed
tests/unit tests/integration e2e/
```

Rules followed (from everything-claude-code): small focused files, immutable
updates, Zod at every boundary, authorization in the service layer (never only
in the UI), no secrets in source, consistent `ActionResult` envelope, tests
first for logic, 80% coverage target on `lib/` and `server/`.

## Phases

1. Foundation — schema, Prisma client, auth (password, sessions, rate limit), design tokens, shells.
2. Pure logic (TDD) — grading, progress, course lifecycle, validation, video embeds, slugs.
3. Services (TDD, integration tests on a real database) — accounts, courses, lessons, assessments, enrolment, submissions, marking, admin.
4. UI — public, student, teacher, admin.
5. Seed data — three subjects, demo courses with real lesson content.
6. E2E — student, teacher, admin critical paths.
7. Verify — build, types, lint, tests + coverage, security scan, review.

## Risks / decisions to revisit

- Brand is Xcel Study (`src/lib/site.ts`, mark in `src/components/brand/wordmark.tsx`). Name and contact details change in one place.
- No payments in v1 — pricing isn't decided. Enrolment is free.
- Rate limits are counters in Postgres (one atomic upsert per hit), so they hold across serverless instances. Move to Redis only if that table gets hot.
- Lesson content is Markdown (no raw HTML). Video embeds limited to YouTube/Vimeo.
- File uploads for assignments are text-only in v1 (no storage bucket yet).

---

# Phase 2 — Choose your teacher (Preply-style)

Students browse every approved teacher, filter by what and when they teach,
read profiles, and pick the teacher they connect with. Picking a teacher opens
an ongoing one-to-one relationship: live sessions booked from the teacher's
availability, and a message thread.

## Flow

```
Directory (/teachers) --filter--> Profile (/teachers/[slug]) --Choose--> Request (goals + optional first session)
                                                                          |
Teacher: /teach/students  <-------------------- PENDING ------------------+
   accept -> ACTIVE (first session CONFIRMED)      decline -> DECLINED (note shown to student)
ACTIVE: book sessions from open slots, message, review; either side can end -> ENDED (future sessions cancelled)
```

## Model

- `TeacherProfile` (1:1 with a teacher user): headline, about, teaching style, experience, qualifications,
  intro video, meeting link, time zone, session length, accepting-new-students, admin `isHidden`.
  `ProfilePhoto` holds the image bytes separately so list queries never load blobs.
- `Topic` belongs to a `Subject` (admin-managed). Teachers pick topics (`TeacherTopic`) and languages (`TeacherLanguage`).
- `AvailabilityWindow`: weekly recurring windows in the teacher's time zone (weekday + start/end minute).
- `TeacherConnection`: one row per student–teacher pair, `PENDING | ACTIVE | DECLINED | ENDED`.
- `TutoringSession`: a live 1:1 session (`REQUESTED | CONFIRMED | CANCELLED`), UTC instants.
- `Message` (per connection), `TeacherReview` (one per student per teacher, admin-hideable), `SavedTeacher`.

## Rules

- Listed in the directory only when the teacher is active, not hidden, and the profile is complete
  (headline, about ≥ 80 chars, a topic, a language, some availability).
- Requests only to listed teachers accepting new students; max 5 pending requests per student.
- Slots: next 14 days, 30-minute steps, at least 12 hours' notice, never overlapping the teacher's
  confirmed sessions (or live requests) or the student's own sessions. The server regenerates slots
  to validate every booking, inside a transaction holding a Postgres advisory lock per person, so two
  people can't take the same slot at once.
- Messages while `PENDING` or `ACTIVE`. Reviews once the student has had at least one session.
- Times are stored in UTC and shown in the viewer's time zone (account setting, else the browser's,
  captured in a cookie).
- No prices: pricing hasn't been decided.

---

# Phase 3 — Live sessions in Xcel Study

Confirmed sessions happen in Xcel Study's own video room, built on LiveKit
([ADR-0001](adr/0001-livekit-for-live-tutoring-video.md)). It switches on when
`LIVEKIT_URL`, `LIVEKIT_API_KEY` and `LIVEKIT_API_SECRET` are all set. Until then,
sessions use the teacher's meeting link as before.

## Flow

```
Session list / dashboard --"Join the session" (full page load)--> /sessions/[id]
  before the window:  "starts at 17:00, room opens at 16:50" (page refreshes itself)
  window open:        camera check --Join--> server action --> service checks --> 10-minute token --> LiveKit
  in the call:        the other person on stage, you in the corner, mic / camera / screen share / chat / leave
  after leaving:      rejoin, or back to the relationship page
LiveKit --signed webhook--> /api/livekit/webhook --> SessionAttendance --> "In the video room: you 52 min, Kemi 50 min."
```

## Model

- `SessionAttendance`: one row per LiveKit connection (`participantSid` unique), with `joinedAt` and `leftAt`.
  Rejoining adds a row; overlapping stays are merged when minutes are counted.

## Rules

- Only the session's student and teacher can see the room or get a token; anyone else gets "not found".
  The session must be CONFIRMED, the partnership ACTIVE, and the account active.
- The room opens 10 minutes before the start and closes 15 minutes after the end (`src/lib/live-sessions.ts`).
- Tokens are for that session's room only, last 10 minutes, and can publish camera, microphone, screen share
  and data (chat pings). Never room admin, create, list or record.
- In-call chat is the pair's message thread (same validation and rate limit); LiveKit only carries a ping.
- The teacher's meeting link stays as a backup inside the room, for an active partnership's session that is
  ahead or under way only.
- Cancelling a session, ending a partnership or suspending an account closes any open room it affects
  (`closeLiveRooms`, best effort). Rooms take two people at most, and the room page leaves at closing time.
- Sessions stay listed with a join link until their room closes, so people can get back in after a drop.
- Webhooks are verified against the raw body's signature before anything is read, and only events for real
  sessions and their two people are recorded.
- Only `/sessions/*` may use the camera, microphone and screen sharing or connect to the LiveKit host.
- No recording until there's a consent and storage policy.

---

# Phase 4 — Email

Email goes through Resend ([ADR-0002](adr/0002-resend-for-transactional-email.md)), in
batches, most important first.

## Batch 1: account emails (done)

| Event | Email | To |
| --- | --- | --- |
| Student signs up | Welcome, with a link to confirm the address | The student |
| Teacher applies | Application received, with a confirmation link | The applicant |
| "Send a new link" | A fresh confirmation link | The person asking |
| "Forgot your password?" | A one-hour, single-use reset link | The account, if there is one |
| Password changed (Account page or reset link) | Security notice, with a reset link | The account |
| Application approved / declined | The decision and what's next | The applicant |
| Account suspended / restored | What happened and how to get help | The person |

## Flow

```
service: change + enqueueEmail(tx) ── one transaction ──> EmailOutbox (PENDING)
action:  sendQueuedEmails() ──after()──> claim due rows (SKIP LOCKED, 2-min lease)
           ──> render template ──> Resend (idempotency key = row id)
           ok: SENT (link payloads emptied)   temporary: retry 1m/5m/30m/2h/12h   permanent: FAILED
daily cron /api/cron/emails: send anything due, prune expired links and old rows
```

## Rules

- Links in emails point at `APP_URL`, else Vercel's production or branch domain, never the request host.
- Confirmation links last 3 days, reset links one hour; both are single use and tied to the address they went to.
- Unconfirmed accounts can sign in and browse, but can't request a teacher, accept a student, book or
  send messages (`requireConfirmedEmail`). Declining and cancelling stay open. A banner offers a new link.
- Using a reset link confirms the address, voids other reset links and signs out every device.
- "Forgot your password?" gives the same answer for any address and is rate limited per IP and per address.
- Without Resend configured, email is printed to the server log (never on production, which won't build without it).

## Next batches

2. Tutoring: request received (teacher), accepted or declined (student), session booked (both, with an
   `.ics` invite), reminders 24 hours and 1 hour before (Resend scheduled sends, cancelled with the
   session), session cancelled, partnership ended.
3. Everything else, with notification preferences and one-click unsubscribe: new messages while away
   (batched), marked work, course review decisions, announcements.
