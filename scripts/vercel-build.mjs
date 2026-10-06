/**
 * Vercel build (vercel.json sets this as the build command): on production
 * deploys, apply database migrations and the demo data switch, then build.
 *
 * Preview deploys skip both, so a branch can never change production, with one
 * opt-in: the staging deploy of the dev branch, which has its own database, sets
 * MIGRATE_ON_DEPLOY=1 in its branch-scoped Preview variables (see README).
 */
import { execSync } from "node:child_process";

const run = (command, env = {}) => execSync(command, { stdio: "inherit", env: { ...process.env, ...env } });

// Regenerate the client first, in case the install step was served from cache.
run("npx prisma generate");

const production = process.env.VERCEL_ENV === "production";
const staging = process.env.VERCEL_ENV === "preview" && process.env.MIGRATE_ON_DEPLOY === "1";

if (production || staging) {
  if (!process.env.DIRECT_URL && !process.env.DATABASE_URL) {
    console.error(`DIRECT_URL (or DATABASE_URL) must be set for ${production ? "production" : "staging"} deploys.`);
    process.exit(1);
  }
  run("npx prisma migrate deploy");

  // Adds or removes the "D-" demo data to match DEMO_DATA_ON_PRODUCTION in
  // scripts/demo-data.ts. It's optional, so a failure is reported, not fatal.
  try {
    run("npx tsx scripts/demo.ts sync", { DATABASE_URL: process.env.DIRECT_URL ?? process.env.DATABASE_URL });
  } catch {
    console.warn("The demo data step failed (details above). Continuing the deploy without it.");
  }
} else {
  console.log(`Skipping migrations and demo data (VERCEL_ENV=${process.env.VERCEL_ENV ?? "unset"}).`);
}

run("npx next build");
