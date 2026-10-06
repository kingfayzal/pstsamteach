import { expect, test } from "@playwright/test";
import { emailedLink, formAlert, logOut } from "./helpers";

async function signUp(page: import("@playwright/test").Page, email: string, secret: string) {
  await page.goto("/signup");
  await page.getByLabel("Full name").fill("Email Tester");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(secret);
  await page.getByRole("button", { name: "Create student account" }).click();
  await expect(page).toHaveURL(/\/learn\?notice=welcome/);
}

test("a new student confirms their email from the welcome email", async ({ page }) => {
  const email = `e2e-confirm-${Date.now()}@example.com`;
  await signUp(page, email, `conf-${Date.now()}-9x`);

  await expect(page.getByText("Confirm your email address.")).toBeVisible();
  await expect(page.getByText(email).first()).toBeVisible();

  // The Account page says so too, with a way to get a new link.
  await page.goto("/account");
  await expect(page.getByText("isn’t confirmed yet")).toBeVisible();

  await page.goto(await emailedLink(email, "welcome", "confirmUrl"));
  await expect(page).toHaveURL(/\/account\?notice=email-confirmed/);
  await expect(page.getByRole("status")).toContainText("Email address confirmed");
  await expect(page.getByText("Confirmed", { exact: true })).toBeVisible();
  await expect(page.getByText("Confirm your email address.")).toHaveCount(0);

  // Opening the link again (a mail scanner may have opened it first) still lands well.
  await page.goto(await emailedLink(email, "welcome", "confirmUrl"));
  await expect(page).toHaveURL(/\/account\?notice=email-confirmed/);

  await page.goto("/confirm-email?token=made-up");
  await expect(page).toHaveURL(/\/confirm-email\/expired/);
  await expect(page.getByText("already confirmed")).toBeVisible();
});

test("someone who forgot their password resets it from the emailed link", async ({ page }) => {
  const email = `e2e-reset-${Date.now()}@example.com`;
  const newSecret = `reset-${Date.now()}-7y`;
  await signUp(page, email, `orig-${Date.now()}-9x`);
  await logOut(page);

  await page.goto("/login");
  await page.getByRole("link", { name: "Forgot your password?" }).click();
  await expect(page).toHaveURL("/forgot-password");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Email me a reset link" }).click();
  await expect(page.getByRole("status")).toContainText("If there's an account for that address");

  const link = await emailedLink(email, "password-reset", "resetUrl");
  await page.goto(link);
  await expect(page.getByRole("heading", { name: "Choose a new password" })).toBeVisible();
  await page.getByLabel("New password", { exact: true }).fill(newSecret);
  await page.getByLabel("Confirm new password").fill(`${newSecret}-typo`);
  await page.getByRole("button", { name: "Save new password" }).click();
  await expect(formAlert(page)).toContainText("Check the highlighted fields");

  await page.getByLabel("New password", { exact: true }).fill(newSecret);
  await page.getByLabel("Confirm new password").fill(newSecret);
  await page.getByRole("button", { name: "Save new password" }).click();
  await expect(page).toHaveURL(/\/account\?notice=password-reset/);
  // Following the link proved the inbox is theirs.
  await expect(page.getByText("Confirmed", { exact: true })).toBeVisible();

  await page.goto(link);
  await expect(page.getByRole("heading", { name: "This link doesn’t work any more" })).toBeVisible();

  await page.goto("/account");
  await logOut(page);
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(newSecret);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/learn/);
});
