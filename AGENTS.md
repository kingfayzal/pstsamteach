<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Project conventions

Read `docs/PLAN.md` (architecture, lifecycle) and `docs/DESIGN.md` (visual system) before changing things.

- **Layers:** `lib/` is pure and unit-tested. `server/services/` takes `(actor, input)`, validates with Zod and enforces authorization itself. `server/queries/` are authorization-aware read models. `server/actions/` stay thin: session, then service, then revalidate/redirect.
- **Never trust the UI for access control.** New service functions check role, status and ownership, and return "not found" for things the actor can't manage.
- **Tests first for logic.** Add unit tests in `tests/unit`, integration tests against Postgres in `tests/integration`, and E2E specs in `e2e/` for user-visible flows. Keep coverage above the thresholds in `vitest.config.mts`.
- **Design:** use the tokens in `globals.css`. Handwriting (`.hand`, Kalam) is only for a teacher's marks and feedback. Subject colour is information, never decoration. No all-caps labels, no arrow glyphs on buttons.
- **Database:** Postgres (Supabase in production). New tables must enable row-level security in their migration (`ALTER TABLE "Name" ENABLE ROW LEVEL SECURITY;`) so Supabase's Data API can't see them; `tests/integration/database.test.ts` enforces it. Raw SQL stays in tagged templates (`$queryRaw`/`$executeRaw`), never string-built.
- **Secrets:** never commit credentials. Demo and E2E passwords come from the environment or are generated at runtime.
- **Commits:** conventional commits (`feat:`, `fix:`, `test:`, `docs:`, `chore:`).
