import { type APIRequestContext, expect, type Page } from "@playwright/test";
import { Client } from "pg";

export const DEMO = {
  admin: "admin@example.com",
  english: "grace@example.com",
  nursing: "ruth@example.com",
  student: "ada@example.com",
  applicant: "samuel@example.com",
  recentStudent: "tobi@example.com",
} as const;

export function password(): string {
  const value = process.env.E2E_PASSWORD;
  if (!value) throw new Error("E2E_PASSWORD is not set; run through `npm run test:e2e`.");
  return value;
}

export async function logIn(page: Page, email: string, secret = password()): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(secret);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

export async function logOut(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Log out" }).first().click();
  await expect(page).toHaveURL("/");
}

/** Form-level error, scoped to the page so Next's route announcer (also role=alert) is ignored. */
export function formAlert(page: Page) {
  return page.locator("main").getByRole("alert");
}

/**
 * Link previews (WhatsApp, Facebook, X, iMessage) must show the Xcel Study logo from the
 * production domain. A broken or missing og:image makes them fall back to the first
 * <img> on the page, which is often a teacher's photo.
 */
export async function expectBrandShareImage(page: Page, request: APIRequestContext): Promise<void> {
  // Once the page has hydrated there must be exactly one of each: streamed metadata used to
  // be rendered a second time in the browser, which only showed up when the check was slow.
  await page.waitForLoadState("networkidle");
  await expect(page.locator("title")).toHaveCount(1);
  await expect(page.locator('meta[property="og:image"]')).toHaveCount(1);
  await expect(page.locator('meta[name="twitter:image"]')).toHaveCount(1);

  const og = await page.locator('meta[property="og:image"]').getAttribute("content");
  const url = new URL(og ?? "");
  expect(url.origin).toBe("https://www.xcelstudy.com");
  expect(url.pathname).toBe("/opengraph-image.png");
  await expect(page.locator('meta[name="twitter:image"]')).toHaveAttribute("content", og ?? "");
  await expect(page.locator('meta[property="og:site_name"]')).toHaveAttribute("content", "Xcel Study");

  const image = await request.get(`${url.pathname}${url.search}`);
  expect(image.status()).toBe(200);
  expect(image.headers()["content-type"]).toBe("image/png");
}

/** Pre-set the time-zone cookie TimeZoneSync would write, so the first render is already local. */
export async function useLagosTime(page: Page): Promise<void> {
  await page.context().addCookies([{ name: "st_tz", value: encodeURIComponent("Africa/Lagos"), url: "http://localhost:3100" }]);
}

/** Same default as playwright.config.ts: the E2E server's own database. */
const E2E_DATABASE_URL = process.env.E2E_DATABASE_URL ?? "postgresql://postgres@localhost:5432/pstsamteach_e2e";

/**
 * The link from the newest email of a kind sent to an address, as a path on the
 * E2E server. Without RESEND_API_KEY the server logs email instead of sending it,
 * and keeps the queued copy, so the test reads the link from there.
 */
export async function emailedLink(to: string, kind: string, field: string): Promise<string> {
  const client = new Client({ connectionString: E2E_DATABASE_URL });
  await client.connect();
  try {
    const { rows } = await client.query<{ payload: Record<string, string> }>(
      'SELECT "payload" FROM "EmailOutbox" WHERE "toEmail" = $1 AND "kind" = $2 ORDER BY "createdAt" DESC LIMIT 1',
      [to, kind],
    );
    const link = rows[0]?.payload[field];
    if (!link) throw new Error(`No ${kind} email with a ${field} was queued for ${to}.`);
    const url = new URL(link);
    return `${url.pathname}${url.search}`;
  } finally {
    await client.end();
  }
}
