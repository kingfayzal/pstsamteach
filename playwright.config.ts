import { execSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { rmSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

/**
 * E2E runs against a production build on port 3100 with its own SQLite file,
 * freshly migrated and seeded. The demo password is generated per run and
 * handed to the tests through the environment, never written to disk.
 */
const PORT = 3100;
const DATABASE_URL = "file:./e2e.db";

// Workers re-evaluate this file; only the main process prepares the database.
if (!process.env.E2E_PASSWORD) {
  process.env.E2E_PASSWORD = `e2e-${randomBytes(8).toString("base64url")}-1`;
  for (const suffix of ["", "-journal", "-wal", "-shm"]) rmSync(`e2e.db${suffix}`, { force: true });
  const env = { ...process.env, DATABASE_URL, SEED_DEMO_PASSWORD: process.env.E2E_PASSWORD };
  execSync("npx prisma migrate deploy", { stdio: "pipe", env });
  execSync("npx prisma db seed", { stdio: "pipe", env });
}

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    // Fixed zone so availability and slot times are deterministic.
    timezoneId: "Africa/Lagos",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // Locally, use the installed Chrome so no browser download is needed.
        channel: process.env.PW_CHANNEL ?? (process.env.CI ? undefined : "chrome"),
      },
    },
  ],
  webServer: {
    command: `npx next build && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    timeout: 300_000,
    reuseExistingServer: false,
    env: { DATABASE_URL, NEXT_DIST_DIR: ".next-e2e" },
  },
});
