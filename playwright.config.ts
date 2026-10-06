import { execSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { defineConfig, devices } from "@playwright/test";

/**
 * E2E runs against a production build on port 3100 with its own Postgres
 * database, freshly migrated and seeded. The demo password is generated per run and
 * handed to the tests through the environment, never written to disk.
 */
const PORT = 3100;
const DATABASE_URL = process.env.E2E_DATABASE_URL ?? "postgresql://postgres@localhost:5432/pstsamteach_e2e";

/**
 * Video rooms use a throwaway LiveKit server in Docker (scripts/e2e-livekit.mjs)
 * with an API key made up for this run, like the password.
 */
const LIVEKIT_URL = "ws://127.0.0.1:7980";
const LIVEKIT_KEY = "e2e";
process.env.E2E_LIVEKIT_SECRET ??= randomBytes(32).toString("hex");

// Workers re-evaluate this file; only the main process prepares the database.
if (!process.env.E2E_PASSWORD) {
  process.env.E2E_PASSWORD = `e2e-${randomBytes(8).toString("base64url")}-1`;
  const env = { ...process.env, DATABASE_URL, DIRECT_URL: DATABASE_URL, SEED_DEMO_PASSWORD: process.env.E2E_PASSWORD };
  execSync("npx prisma migrate deploy", { stdio: "pipe", env });
  execSync("npx prisma db seed", { stdio: "pipe", env });
}

export default defineConfig({
  testDir: "./e2e",
  globalTeardown: "./e2e/global-teardown.ts",
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
        // A generated camera and microphone, with no permission prompt, for the video room tests.
        launchOptions: { args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] },
      },
    },
  ],
  webServer: [
    {
      command: "node scripts/e2e-livekit.mjs",
      url: LIVEKIT_URL.replace("ws:", "http:"),
      // The first run pulls the image.
      timeout: 180_000,
      reuseExistingServer: false,
      env: { LIVEKIT_KEYS: `${LIVEKIT_KEY}: ${process.env.E2E_LIVEKIT_SECRET}` },
    },
    {
      command: `npx next build && npx next start -p ${PORT}`,
      url: `http://localhost:${PORT}`,
      timeout: 300_000,
      reuseExistingServer: false,
      env: {
        DATABASE_URL,
        DIRECT_URL: DATABASE_URL,
        NEXT_DIST_DIR: ".next-e2e",
        // Links in emails point back at this server.
        APP_URL: `http://localhost:${PORT}`,
        LIVEKIT_URL,
        LIVEKIT_API_KEY: LIVEKIT_KEY,
        LIVEKIT_API_SECRET: process.env.E2E_LIVEKIT_SECRET,
      },
    },
  ],
});
