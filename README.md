# Xcel Study

Xcel Study (*Learning with ease*) is a tutoring and teaching platform. The platform's subjects are **Mathematics, English, Vocational Development and Test Preparation**, each with its topics (from the SAT and IELTS to WAEC, NECO and UTME), defined in `prisma/seed-content/catalog.ts` and added to every database once by a migration; after that, admins manage subjects and topics. Local demo data also has Nursing, Yoruba and Music (bass guitar). It has three sides:

- **Students** choose their own teacher from a directory (filter by subject, topic, language, day and time of day; read profiles, watch intro videos, check the availability timetable and reviews). They send a request, book live one-to-one sessions once accepted, and message their teacher. They can also enrol in courses, work through lessons, take auto-marked quizzes, hand in written assignments, and see grades and feedback.
- **Teachers** apply to teach, build a directory profile (photo, headline, about, teaching style, qualifications, topics, languages, intro video, meeting link, weekly availability), accept or decline student requests, run one-to-one sessions, and message students. They also build courses, submit them for review, mark submitted work, post announcements, and follow each student's progress.
- **Admins** (the platform owners) approve teachers, moderate the teacher directory (hide profiles or reviews), manage subjects and their topics, review and publish courses, suspend accounts, post platform-wide announcements, and read the activity log and platform numbers.

> The name, tagline, production URL and public contact details live in `src/lib/site.ts` (the contact details are overridable with `SUPPORT_EMAIL` and `SUPPORT_PHONE`). The logo mark is in `src/components/brand/wordmark.tsx`, and the favicon, Apple icon and social-share image are `icon.svg`, `apple-icon.png` and `opengraph-image.png` in `src/app/`. Every page shares that one logo image, loaded from the production URL. The repository keeps its original name, `pstsamteach`.

## Quick start

Requires Node 20.9+ (developed on Node 24) and Postgres. The easiest local Postgres is Docker:

```bash
npm install
cp .env.example .env
npm run db:up        # Postgres 17 in Docker, on localhost:5432
npm run setup        # migrate, generate the Prisma client, seed demo data
npm run dev          # http://localhost:3000
```

**Video sessions (optional):** put a `LIVEKIT_API_KEY` and a long random `LIVEKIT_API_SECRET` in `.env` with `LIVEKIT_URL="ws://localhost:7880"`, then `npm run livekit:up` starts a LiveKit server in Docker with the same pair. Leave the three unset and sessions use each teacher's meeting link instead.

**Email (optional locally):** without `RESEND_API_KEY`, emails aren't sent. The dev server prints each one to the terminal instead, links included, so you can follow a confirmation or reset link.

No Docker? Any Postgres works: point `DATABASE_URL` and `DIRECT_URL` in `.env` at it. `npx prisma dev` starts a throwaway local one and prints its URL. It serves one connection at a time, so also set `DATABASE_POOL_MAX=1`.

`npm run setup` prints the demo accounts. They all share one password: whatever you put in `SEED_DEMO_PASSWORD` in `.env`, or a random one printed once if you leave it empty.

| Account | Email |
| --- | --- |
| Admin | `admin@example.com` |
| Teachers (English, Maths, Nursing) | `grace@`, `daniel@`, `ruth@example.com`, plus `blessing@`, `kwame@`, `amaka@`, `yusuf@example.com` |
| Teachers (Yoruba, Music) | `bisi@`, `femi@example.com` |
| Pending teacher application | `samuel@example.com` |
| Students | `ada@` (working with Ruth, waiting on Daniel), `kemi@`, `tomi@example.com` (plus 8 recent sign-ups) |

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server (Turbopack) |
| `npm run build` / `npm start` | Production build and server |
| `npm run lint` / `npm run typecheck` | ESLint / TypeScript |
| `npm test` | Unit + integration tests (Vitest) against a real Postgres test database |
| `npm run test:coverage` | Same, with coverage gates (80% lines/statements/functions, 75% branches) |
| `npm run test:e2e` | Playwright end-to-end tests against a production build with its own seeded database |
| `npm run db:up` / `npm run db:down` | Start / stop the local Postgres container |
| `npm run livekit:up` / `npm run livekit:down` | Start / stop the local LiveKit (video) container, using the key and secret in `.env` |
| `npm run db:migrate` | Create a migration after editing `prisma/schema.prisma` |
| `npm run db:deploy` | Apply pending migrations (what production runs on each deploy) |
| `npm run db:seed` / `npm run db:reset` | Reseed / wipe and rebuild the local database |
| `npm run create-admin` | Create the first admin, or promote an account, on any database (see Deploying) |
| `npm run demo:add` / `npm run demo:remove` | Add or remove the labelled "D-" demo subjects, teachers and students on any database by hand (production follows a switch; see Deploying) |

Tests use their own databases on the same server: `pstsamteach_test` and `pstsamteach_e2e` (override with `TEST_DATABASE_URL` / `E2E_DATABASE_URL`). They're created and migrated automatically, and refuse to run against anything but a local database. The E2E suite also starts a throwaway LiveKit server in Docker (`scripts/e2e-livekit.mjs`, ports 7980–7982, a random key per run), so Docker must be running. Playwright uses your installed Chrome locally, with a fake camera and microphone. In CI, GitHub Actions runs everything against a Postgres 17 service.

## How it's built

| Layer | Choice |
| --- | --- |
| App | Next.js 16 App Router, Server Components, Server Actions, hosted on [Vercel](https://vercel.com) |
| Data | Prisma 7 on Postgres through the node-postgres driver adapter: Docker locally, [Supabase](https://supabase.com) in production |
| Auth | Own implementation: scrypt password hashes, random session tokens stored hashed in the database, httpOnly cookie |
| Email | [Resend](https://resend.com), behind a small adapter, with a Postgres outbox for retries |
| Validation | Zod at every boundary |
| Styling | Tailwind CSS 4 with design tokens in `src/app/globals.css` |
| Tests | Vitest and Playwright |

```
src/
  app/            routes: (public), (auth), learn/, teach/, admin/, account/, sessions/ (video rooms), api/livekit/ (webhook), api/cron/ (daily email job)
  components/     ui/, brand/, shell/, course/, forms/, admin/, teachers/, live/
  lib/            pure logic: grading, progress, course lifecycle, validation, video, slugs, formatting, email templates
  server/
    auth/         passwords, sessions, emailed link tokens, rate limiting
    services/     business operations, with authorization built in
    queries/      read models for pages, authorization-aware
    actions/      thin "use server" wrappers: session → service → revalidate/redirect
    video/        the video provider adapter (LiveKit): join tokens, webhook verification
    email/        the email adapter (Resend, or the log locally) and the outbox that queues, sends and retries
prisma/           schema, migrations, seed and demo course content
tests/            unit/ and integration/
e2e/              Playwright specs
docs/             PLAN.md (build plan), DESIGN.md (design rationale), adr/ (architecture decisions)
```

**Authorization lives in the service and query layer**, not just the UI: every service takes the acting user and checks role, status and ownership itself. Things you can't manage come back as "not found", so their existence doesn't leak. Quiz answer keys never reach the browser until after a quiz is submitted (checked by an E2E test).

**Choosing a teacher:** a student sends a request (with their goals and, optionally, a first session time) to a listed teacher who is taking students. The teacher accepts (the first session is confirmed) or declines with a note. Once accepted, the student books sessions from the teacher's open slots: next 14 days, 30-minute steps, at least 12 hours ahead, never clashing with either person's other sessions. Each booking runs in a transaction holding a Postgres advisory lock per person, so two students can't take the same slot at the same moment. Times are stored in UTC and shown in each viewer's own time zone.

**Live sessions** ([ADR-0001](docs/adr/0001-livekit-for-live-tutoring-video.md)): with LiveKit configured, each confirmed session has its own video room at `/sessions/<id>`, open from 10 minutes before the start to 15 minutes after the end. The server hands out a 10-minute join token only to the session's student and teacher. The room has a camera check, screen sharing, and a chat that is the pair's normal message thread, so it's saved. The teacher's meeting link stays as a "Trouble connecting?" backup. LiveKit's signed webhooks record who was in the room, and past sessions show it. Without LiveKit configured, sessions use the teacher's meeting link, shown only on confirmed sessions.

**Account emails** ([ADR-0002](docs/adr/0002-resend-for-transactional-email.md)): new students get a welcome email with a link to confirm their address, and teacher applicants get one that also says their application arrived. Nothing that needs an account works until the address is confirmed, for students, teachers and admins alike: every signed-in page sends them to **Confirm your email address** (`/check-email`), where they can get a new link, fix a mistyped address or log out. The link then takes them to their own dashboard. Login has "Forgot your password?", which emails a one-hour, single-use reset link. People are also emailed when their password changes, their teacher application is approved or declined, and their account is suspended or restored. Email is queued in the same database transaction as the change it reports, sent straight after the response through Resend, and retried with back-off if Resend is down.

**Course lifecycle:** Draft → In review (teacher submits) → Published (admin approves) → Archived. Admins can send a course back with notes, or unpublish it. Teachers can't edit a course while it's in review.

## Security

- Passwords: scrypt (N=16384), per-user salt, constant-time comparison, dummy hash on unknown emails to avoid timing leaks.
- Sessions: 32-byte random tokens; only the SHA-256 hash is stored. Suspending a user ends their sessions immediately. Changing your password signs out other devices.
- CSRF: all mutations are Server Actions (origin-checked by Next.js); cookies are `SameSite=Lax`.
- Rate limiting on login, sign-up, password resets, confirmation emails, teacher requests and messages. Counters live in Postgres, so limits hold across every serverless instance.
- Content Security Policy, `frame-ancestors 'none'`, `nosniff`, a strict referrer policy and HSTS in production. Video embeds are limited to YouTube (privacy-enhanced) and Vimeo.
- Video rooms: join tokens are minted server-side after the same checks as every other service (party, confirmed, join window), are scoped to one two-person room, and expire in 10 minutes. Cancelling a session, ending a partnership or suspending an account closes any open room it affects. Only `/sessions/*` may use the camera, microphone and screen sharing or connect to the LiveKit host. Webhooks are rejected unless they're signed and the signature matches the raw body (capped at 64 KiB).
- Email links: confirmation and reset tokens are 32 random bytes, stored only as SHA-256 hashes, tied to the address they were sent to, and single use (reset links last one hour, confirmation links 3 days). Using a reset link signs out every device and voids other reset links. "Forgot your password?" answers the same whether or not an account exists, and is rate limited per IP and per address. Links point at `APP_URL` or Vercel's own domain, never the request's Host header. Once an email carrying a link has been sent, its stored copy is emptied.
- Lesson Markdown is rendered without raw HTML, and unsafe URLs are stripped.
- Every admin action and course decision is written to an append-only activity log.

## Deploying (Vercel + Supabase)

The free tiers of both are enough for an MVP. You need a GitHub account with access to this repo.

### 1. Database: Supabase

1. Create a project at [supabase.com](https://supabase.com). Choose the region closest to your users, and keep the database password in a password manager.
2. Click **Connect** and copy two connection strings, putting your database password in place of `[YOUR-PASSWORD]` (URL-encode it if it contains symbols such as `@` or `#`):
   - **Transaction pooler** (port 6543): this is `DATABASE_URL`, used by the app.
   - **Session pooler** (port 5432): this is `DIRECT_URL`, used to run migrations.

   Vercel can't use Supabase's direct connection (`db.<ref>.supabase.co`) because it's IPv6-only. The poolers work over IPv4.
3. The app talks to Postgres directly and never uses Supabase's Data API; the migrations switch on row-level security for every table, which hides them from that API. You can also turn the Data API off in the project's API settings.
4. Optional hardening: under **Database Settings → SSL Configuration**, download the certificate and paste its contents into a `DATABASE_CA_CERT` variable (next step). Without it the connection is still encrypted, but the server's certificate isn't verified.

### 2. App: Vercel

1. At [vercel.com/new](https://vercel.com/new), import this GitHub repo. Next.js is detected automatically, and `vercel.json` sets the build command to `npm run vercel-build`, so leave the build settings alone.
2. Before the first deploy, add these environment variables (**Settings → Environment Variables**), scoped to **Production**:

   | Variable | Value |
   | --- | --- |
   | `DATABASE_URL` | Supabase transaction pooler string |
   | `DIRECT_URL` | Supabase session pooler string |
   | `DATABASE_CA_CERT` | Optional, see above |
   | `SUPPORT_EMAIL`, `SUPPORT_PHONE` | Optional. Leave unset to use Xcel Study's public contact details |
   | `RESEND_API_KEY`, `EMAIL_FROM`, `CRON_SECRET` | Email, see step 6. Production builds fail without the first two |

3. In **Settings → Functions**, set the function region to the one nearest your Supabase region. Every page makes several database queries, so a long hop between the two slows everything down.
4. Deploy. Production builds apply any new migrations (`prisma migrate deploy`) before building. Preview deployments skip migrations and, without database variables of their own, can't reach a database. The `dev` branch gets its own database as staging (step 7).

### 3. First admin

Run this once from your machine, pointing at production with the session pooler string:

```bash
DATABASE_URL="<session pooler string>" ADMIN_EMAIL="you@example.com" ADMIN_NAME="Your Name" npm run create-admin
```

It prints a one-time password (or uses `ADMIN_PASSWORD` if you set it). Sign in, confirm the email address from the link we send (admins wait for it like everyone else), then change the password under **Account**. If the email already has an account, that account is promoted to admin instead. Don't seed production: the seed refuses remote databases unless `SEED_ALLOW_REMOTE=1`, and every demo account shares one password.

### 4. Demo data

Three clearly labelled demo subjects (D-Science, D-History, D-Geography), teachers (D-Mark Buck, D-Amara Eze, D-Tunde Bakare) and students (D-Chioma Okeke, D-Liam Carter, D-Zainab Bello) show the platform before real teachers join.

Production follows a switch in the repo: `DEMO_DATA_ON_PRODUCTION` in `scripts/demo-data.ts`. While it's `true`, each production deploy adds the demo data if none of it is there yet, and otherwise leaves it alone (so passwords and anything edited during a demo stay). Set it to `false` and push, and the next deploy removes exactly the demo records and anything attached to them (requests, messages, sessions, and courses made by demo teachers). Nothing else is touched.

- **Demo logins:** the emails are `d-mark.buck@example.com`, `d-chioma.okeke@example.com` and so on. All six accounts share one password, printed once in the build log of the deploy that created them (Vercel → Deployments → that deploy → Build Logs, search for "demo"). To choose it yourself instead, add a `DEMO_PASSWORD` environment variable before that deploy.
- **They're public:** the demo teachers are listed in the directory and accept requests, so real visitors can find them too. Switch the demo data off before launch.
- **By hand:** `DATABASE_URL="<session pooler string>" npm run demo:add` (or `demo:remove`) does the same on any database, and `add` resets the demo records to their definition with a new password.
- **Quick logins:** `DATABASE_URL="<session pooler string>" DEMO_PASSWORD="<password>" npm run demo:logins` adds `student@`, `teacher@` and `admin@xceldemo.com`, sharing that password (the teacher teaches every demo subject, so the demo student can request and book them). Running it again resets them. On the live site add `-- --no-admin`: a guessable admin login would hand anyone the admin side, so that run leaves it out and removes one made earlier. Switching the demo data off removes these accounts too.

### 5. Live video: LiveKit Cloud

1. Create a project at [cloud.livekit.io](https://cloud.livekit.io). Under **Settings → Keys**, create an API key.
2. In Vercel, add `LIVEKIT_URL` (the project's `wss://…livekit.cloud` address), `LIVEKIT_API_KEY` and `LIVEKIT_API_SECRET`, all three or none (a partial set fails the build). Redeploy: the camera and connection rules for the room are fixed at build time.
3. In LiveKit, under **Settings → Webhooks**, add `https://<your-domain>/api/livekit/webhook`, signed with the same API key, so attendance is recorded.
4. Join a session from two devices to check it. Keep teachers' meeting links filled in: they're the in-room backup.

To move to a self-hosted LiveKit server later, change `LIVEKIT_URL` (and the key pair). Nothing else changes.

### 6. Email: Resend

Account emails go through [Resend](https://resend.com) ([ADR-0002](docs/adr/0002-resend-for-transactional-email.md)). Production deploys fail until it's set up, because without it nobody could confirm an address or reset a password.

1. Create an account at [resend.com](https://resend.com). Under **Domains**, add the domain you'll send from. Resend suggests a subdomain such as `mail.xcelstudy.com`, which keeps the main domain's reputation separate.
2. Add the DNS records Resend shows (DKIM, SPF and the bounce MX record) at your domain registrar, and wait until Resend marks the domain verified. Add a DMARC record too: a TXT record at `_dmarc` with `v=DMARC1; p=none;` to start. Gmail and Yahoo expect one.
3. Under **API Keys**, create a key with **Sending access** only, limited to that domain. Make a second one for staging.
4. In Vercel, add these, scoped to **Production**:

   | Variable | Value |
   | --- | --- |
   | `RESEND_API_KEY` | The production key (it starts with `re_`) |
   | `EMAIL_FROM` | The sender, on the verified domain, e.g. `Xcel Study <hello@mail.xcelstudy.com>`. A Gmail address won't work |
   | `EMAIL_REPLY_TO` | Optional. Where replies go. Defaults to the support address in `src/lib/site.ts` |
   | `CRON_SECRET` | A long random string (`openssl rand -hex 32`). Vercel sends it with the daily email job |
   | `APP_URL` | Optional. The address links in emails point to. Defaults to Vercel's production domain |

5. Redeploy, then use **Forgot your password?** with your own account to check an email arrives.

Email goes out straight after the action that triggers it. If Resend fails, it's retried with back-off for about 15 hours, by the next email sent or by the daily job (`/api/cron/emails`, 06:00 UTC, in `vercel.json`), which also clears out expired links. Resend's dashboard shows every email and whether it was delivered. The free plan sends 3,000 emails a month and 100 a day; move to Pro ($20 a month for 50,000) before the daily cap gets close.

### 7. Staging: the `dev` branch

`dev` deploys to its own Vercel Preview with its own database, so every change can be tried before it reaches production.

1. Create a staging database, never production's. Either:
   - **Supabase:** a second project (for example `xcel-study-staging`) in the same region; copy its two pooler strings as in step 1. The free plan allows only two projects.
   - **Neon** (what staging uses now; free plan, [neon.com](https://neon.com)): create a project with only **Postgres database** switched on, Postgres 17, in the region nearest your Vercel functions. Under **Connect**, with **Show password** on, copy the string with **Connection pooling** on (its host has `-pooler`) for `DATABASE_URL`, and with pooling off for `DIRECT_URL`. Delete `&channel_binding=require` from the end of both: Prisma's migrations can't handle it. Connect it by hand with the variables below, not Neon's Vercel integration, which would attach it to every preview branch. A free Neon database sleeps after 5 idle minutes, so the first visit after a break takes a second longer.
2. In Vercel, add variables scoped to **Preview** and the Git branch **`dev`** (pick the branch when adding each one). Vercel won't take a second variable with the same name for an environment one already covers: production's `DATABASE_URL`, `DIRECT_URL`, `EMAIL_FROM` and so on must be scoped to **Production** only, not "Production and Preview", before their `dev` copies can be added.

   | Variable | Value |
   | --- | --- |
   | `DATABASE_URL`, `DIRECT_URL` | The staging database's pooled and direct strings, never production's |
   | `MIGRATE_ON_DEPLOY` | `1`: lets this branch's deploys apply migrations and the demo data switch to the staging database |
   | `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` | Optional: a second LiveKit project's, so staging calls never mix with production's |
   | `RESEND_API_KEY`, `EMAIL_FROM` | The staging key and the same sender. Without them, emails are written to the function logs instead of sent, so new staging accounts can't confirm their address |
   | `APP_URL` | Optional: the staging address (e.g. `https://staging.xcelstudy.com`) if you give `dev` a domain. Otherwise links use the branch's Vercel address |

3. Redeploy `dev` (**Deployments**, the newest `dev` deploy, **⋯ → Redeploy**). The build log should list the migrations being applied and print the demo accounts. Staging is at `https://<project>-git-dev-<team>.vercel.app` (Vercel login required). To make yourself an admin there, run `npm run create-admin` (see "3. First admin" above) with `DATABASE_URL` set to the staging direct string.
4. Optional: under **Settings → Domains**, give `dev` a stable address such as `staging.xcelstudy.com`, and under **Settings → Deployment Protection** keep previews behind Vercel login. A protected preview can't receive LiveKit webhooks, so attendance isn't recorded on staging unless you add a protection bypass for them.

## Branches and releases

- **`main`** is production: Vercel deploys it to the live site. It only changes through a pull request from `dev` (a release) or an urgent fix.
- **`dev`** is staging: features are integrated and tested there first (step 7).
- **Work** happens on short-lived branches cut from `dev` (`feat/…`, `fix/…`, `chore/…`) and merged back with a pull request once CI passes. CI runs on every pull request and on pushes to `main` and `dev`.
- **Urgent fixes** branch from `main`, go to `main` by pull request, and are merged back into `dev`.

### Before real users arrive

- Supabase pauses free projects after a week without activity, and the free plan's backups are limited. Move to a paid plan before launch.
- Teacher photos are stored in Postgres (2 MB cap). That's fine for an MVP; move them to object storage (such as Supabase Storage) as the directory grows.
- Add your domain under Vercel **Settings → Domains**. HSTS is sent in production, so serve the whole domain over HTTPS.

## Not in v1 (decisions needed)

- **Payments and pricing.** Enrolment and sessions are free; no pricing has been decided, so teacher profiles show no rates.
- **Recording sessions.** Not until there's a consent and storage policy, since some students are minors.
- **Video from Nigeria.** LiveKit Cloud's nearest region is Johannesburg. Measure call quality on MTN, Airtel, Glo and fibre before launch; ADR-0001 lists the fallbacks.
- **Session emails.** Account emails are done; requests, bookings (with calendar invites), reminders, cancellations and new messages still show as in-app badges only. They're the next batch on the same email setup.
- **File uploads.** Assignments are typed answers. Teacher photos are stored in the database (2 MB cap), which is fine at this scale; move them to object storage later.
- **Domain.** Xcel Study's Facebook page lists `xcel-study.com`, while the scope of work says `excelstudy.com`. Confirm which one before adding it in Vercel.
