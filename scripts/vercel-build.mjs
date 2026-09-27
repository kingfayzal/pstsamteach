/**
 * Vercel build (vercel.json sets this as the build command): apply database
 * migrations on production deploys only, then build. Preview deploys skip
 * migrations so a branch can never change the production schema.
 */
import { execSync } from "node:child_process";

const run = (command) => execSync(command, { stdio: "inherit" });

if (process.env.VERCEL_ENV === "production") {
  if (!process.env.DIRECT_URL && !process.env.DATABASE_URL) {
    console.error("DIRECT_URL (or DATABASE_URL) must be set for production deploys.");
    process.exit(1);
  }
  run("npx prisma migrate deploy");
} else {
  console.log(`Skipping migrations (VERCEL_ENV=${process.env.VERCEL_ENV ?? "unset"}).`);
}

// Regenerate the client in case the install step was served from cache.
run("npx prisma generate");
run("npx next build");
