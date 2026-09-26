import { expect, type Page } from "@playwright/test";

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

/** Pre-set the time-zone cookie TimeZoneSync would write, so the first render is already local. */
export async function useLagosTime(page: Page): Promise<void> {
  await page.context().addCookies([{ name: "st_tz", value: encodeURIComponent("Africa/Lagos"), url: "http://localhost:3100" }]);
}
