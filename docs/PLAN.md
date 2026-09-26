# Build plan — v1

A teaching platform with three sides: students learn, teachers publish and
mark, platform owners run it. Starting subjects: English, Mathematics, Nursing.

## Stack

| Layer | Choice | Why |
| --- | --- | --- |
| App | Next.js 16 (App Router, Server Actions, Turbopack) | One codebase for UI + server logic; actions give CSRF-safe mutations |
| Language | TypeScript (strict) | |
| Styling | Tailwind CSS 4 + CSS tokens | Design tokens live in `globals.css` |
| Data | Prisma 7 + libSQL/SQLite | Local file in dev, Turso in prod — same SQL dialect, no schema switch |
| Validation | Zod 4 | Every form and action input is parsed at the boundary |
| Auth | Own session auth: scrypt hashes, DB sessions, httpOnly cookie | No third-party dependency; sessions revocable (suspend = instant logout) |
| Tests | Vitest (unit + integration against a real SQLite file), Playwright (E2E) | |

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
3. Services (TDD, integration tests on SQLite) — accounts, courses, lessons, assessments, enrolment, submissions, marking, admin.
4. UI — public, student, teacher, admin.
5. Seed data — three subjects, demo courses with real lesson content.
6. E2E — student, teacher, admin critical paths.
7. Verify — build, types, lint, tests + coverage, security scan, review.

## Risks / decisions to revisit

- Brand name is a placeholder (`src/lib/site.ts`). Rename in one place.
- No payments in v1 — pricing isn't decided. Enrolment is free.
- In-memory rate limiter resets per server instance; swap for Redis/Upstash when deployed to more than one instance.
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
  to validate every booking; SQLite's serialised writes stop two people taking the same slot.
- Messages while `PENDING` or `ACTIVE`. Reviews once the student has had at least one session.
- Times are stored in UTC and shown in the viewer's time zone (account setting, else the browser's,
  captured in a cookie).
- No prices: pricing hasn't been decided.
