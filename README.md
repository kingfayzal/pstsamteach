# SamTeach

A teaching platform for **English, Mathematics and Nursing** with three sides:

- **Students** choose their own teacher from a directory (filter by subject, topic, language, day and time of day; read profiles, watch intro videos, check the availability timetable and reviews). They send a request, book live one-to-one sessions once accepted, and message their teacher. They can also enrol in courses, work through lessons, take auto-marked quizzes, hand in written assignments, and see grades and feedback.
- **Teachers** apply to teach, build a directory profile (photo, headline, about, teaching style, qualifications, topics, languages, intro video, meeting link, weekly availability), accept or decline student requests, run one-to-one sessions, and message students. They also build courses, submit them for review, mark submitted work, post announcements, and follow each student's progress.
- **Admins** (the platform owners) approve teachers, moderate the teacher directory (hide profiles or reviews), manage subjects and their topics, review and publish courses, suspend accounts, post platform-wide announcements, and read the activity log and platform numbers.

> "SamTeach" is a working name taken from the repository. Change it in `src/lib/site.ts`.

## Quick start

Requires Node 20.9+ (developed on Node 24).

```bash
npm install
cp .env.example .env
npm run setup        # migrate, generate the Prisma client, seed demo data
npm run dev          # http://localhost:3000
```

`npm run setup` prints the demo accounts. They all share one password: whatever you put in `SEED_DEMO_PASSWORD` in `.env`, or a random one printed once if you leave it empty.

| Account | Email |
| --- | --- |
| Admin | `admin@example.com` |
| Teachers (English, Maths, Nursing) | `grace@`, `daniel@`, `ruth@example.com`, plus `blessing@`, `kwame@`, `amaka@`, `yusuf@example.com` |
| Pending teacher application | `samuel@example.com` |
| Students | `ada@` (working with Ruth, waiting on Daniel), `kemi@`, `tomi@example.com` (plus 8 recent sign-ups) |

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server (Turbopack) |
| `npm run build` / `npm start` | Production build and server |
| `npm run lint` / `npm run typecheck` | ESLint / TypeScript |
| `npm test` | Unit + integration tests (Vitest, real SQLite test database) |
| `npm run test:coverage` | Same, with coverage gates (80% lines/statements/functions, 75% branches) |
| `npm run test:e2e` | Playwright end-to-end tests against a production build with its own seeded database |
| `npm run db:migrate` | Create a migration after editing `prisma/schema.prisma` |
| `npm run db:seed` / `npm run db:reset` | Reseed / wipe and rebuild the local database |

Playwright uses your installed Chrome locally. In CI it installs Chromium.

## How it's built

| Layer | Choice |
| --- | --- |
| App | Next.js 16 App Router, Server Components, Server Actions |
| Data | Prisma 7 on libSQL: a SQLite file locally, [Turso](https://turso.tech) in production (same dialect, no schema changes) |
| Auth | Own implementation: scrypt password hashes, random session tokens stored hashed in the database, httpOnly cookie |
| Validation | Zod at every boundary |
| Styling | Tailwind CSS 4 with design tokens in `src/app/globals.css` |
| Tests | Vitest and Playwright |

```
src/
  app/            routes: (public), (auth), learn/, teach/, admin/, account/
  components/     ui/, brand/, shell/, course/, forms/, admin/
  lib/            pure logic: grading, progress, course lifecycle, validation, video, slugs, formatting
  server/
    auth/         passwords, sessions, rate limiting
    services/     business operations, with authorization built in
    queries/      read models for pages, authorization-aware
    actions/      thin "use server" wrappers: session → service → revalidate/redirect
prisma/           schema, migrations, seed and demo course content
tests/            unit/ and integration/
e2e/              Playwright specs
docs/             PLAN.md (build plan), DESIGN.md (design rationale)
```

**Authorization lives in the service and query layer**, not just the UI: every service takes the acting user and checks role, status and ownership itself. Things you can't manage come back as "not found", so their existence doesn't leak. Quiz answer keys never reach the browser until after a quiz is submitted (checked by an E2E test).

**Choosing a teacher:** a student sends a request (with their goals and, optionally, a first session time) to a listed teacher who is taking students. The teacher accepts (the first session is confirmed) or declines with a note. Once accepted, the student books sessions from the teacher's open slots: next 14 days, 30-minute steps, at least 12 hours ahead, never clashing with either person's other sessions. Times are stored in UTC and shown in each viewer's own time zone. Sessions happen on the teacher's own meeting link, which is only shown on confirmed sessions.

**Course lifecycle:** Draft → In review (teacher submits) → Published (admin approves) → Archived. Admins can send a course back with notes, or unpublish it. Teachers can't edit a course while it's in review.

## Security

- Passwords: scrypt (N=16384), per-user salt, constant-time comparison, dummy hash on unknown emails to avoid timing leaks.
- Sessions: 32-byte random tokens; only the SHA-256 hash is stored. Suspending a user ends their sessions immediately. Changing your password signs out other devices.
- CSRF: all mutations are Server Actions (origin-checked by Next.js); cookies are `SameSite=Lax`.
- Rate limiting on login and sign-up (in memory, per instance).
- Content Security Policy, `frame-ancestors 'none'`, `nosniff`, a strict referrer policy and HSTS in production. Video embeds are limited to YouTube (privacy-enhanced) and Vimeo.
- Lesson Markdown is rendered without raw HTML, and unsafe URLs are stripped.
- Every admin action and course decision is written to an append-only activity log.

## Deploying (Vercel + Turso)

1. Create a Turso database and an auth token.
2. Set `DATABASE_URL=libsql://…` and `DATABASE_AUTH_TOKEN=…` in the host's environment.
3. Run `npm run db:deploy` against it once (and after each new migration).
4. Create the first admin: sign up normally, then promote that account in the database (`UPDATE User SET role='ADMIN' WHERE email='…'`). The seed refuses to run against a remote database unless you set `SEED_ALLOW_REMOTE=1`.

## Not in v1 (decisions needed)

- **Payments and pricing.** Enrolment and sessions are free; no pricing has been decided, so teacher profiles show no rates.
- **Built-in video.** Sessions use each teacher's own Zoom/Meet/Teams link.
- **Notifications.** New requests, messages and bookings show as in-app badges only; email or SMS needs a provider.
- **Email.** No verification, password reset or notification emails yet. Needs an email provider.
- **File uploads.** Assignments are typed answers. Teacher photos are stored in the database (2 MB cap), which is fine at this scale; move them to object storage later.
- **Rate limiting across instances.** Swap the in-memory limiter for Redis/Upstash when running more than one server.
- **Brand.** The name and support email in `src/lib/site.ts` are placeholders.
