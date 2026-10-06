import { expect, type Page, test } from "@playwright/test";
import { DEMO, emailedLink, formAlert, logIn, logOut, setEmailConfirmed } from "./helpers";

async function signUp(page: Page, email: string, secret: string) {
  await page.goto("/signup");
  await page.getByLabel("Full name").fill("Email Tester");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(secret);
  await page.getByRole("button", { name: "Create student account" }).click();
  await expect(page).toHaveURL("/check-email");
}

/** Every page that needs an account sends an unconfirmed one back to the confirm page. */
async function expectHeldAtConfirm(page: Page, paths: string[]) {
  for (const path of paths) {
    await page.goto(path);
    await expect(page, `${path} should wait for the email address`).toHaveURL(/\/check-email$/);
  }
  await expect(page.getByRole("heading", { name: "Confirm your email address" })).toBeVisible();
}

test("a new student can do nothing until they confirm, and can fix a mistyped address", async ({ page }) => {
  const stamp = Date.now();
  const typo = `e2e-confirm-${stamp}@exmaple.com`;
  const email = `e2e-confirm-${stamp}@example.com`;
  await signUp(page, typo, `conf-${stamp}-9x`);
  await expect(page.getByText(typo)).toBeVisible();

  await expectHeldAtConfirm(page, ["/learn", "/learn/teachers", "/account", "/teachers/ruth-mensah/choose"]);

  // Wrong address: move the account to the right one; the first link stops working.
  const firstLink = await emailedLink(typo, "welcome", "confirmUrl");
  await page.getByText("Wrong address?").click();
  await page.getByLabel("Correct email address").fill(email);
  await page.getByRole("button", { name: "Send the link to this address" }).click();
  await expect(page).toHaveURL(/\/check-email\?notice=email-changed/);
  await expect(page.getByRole("status")).toContainText("We've sent a new link to it");
  await expect(page.getByText(email)).toBeVisible();

  await page.goto(firstLink);
  await expect(page).toHaveURL(/\/confirm-email\/expired/);

  const link = await emailedLink(email, "confirm-email", "confirmUrl");
  await page.goto(link);
  await expect(page).toHaveURL(/\/learn\?notice=email-confirmed/);
  await expect(page.getByRole("status")).toContainText("Email address confirmed");

  await page.goto("/account");
  await expect(page.getByText("Confirmed", { exact: true })).toBeVisible();

  // Opening the link again (a mail scanner may have opened it first) still lands well,
  // and the confirm page has nothing left to ask.
  await page.goto(link);
  await expect(page).toHaveURL(/\/learn\?notice=email-confirmed/);
  await page.goto("/check-email");
  await expect(page).toHaveURL(/\/learn$/);
});

test("teacher applicants and admins wait for their email too", async ({ page }) => {
  const stamp = Date.now();
  const email = `e2e-apply-${stamp}@example.com`;
  await page.goto("/apply");
  await page.getByLabel("Full name").fill("Applicant Tester");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(`apply-${stamp}-9x`);
  await page.getByLabel("Subject you want to teach").selectOption({ label: "Mathematics" });
  await page.getByLabel("Your teaching experience").fill("I have taught secondary school mathematics for eight years, mostly exam preparation.");
  await page.getByRole("button", { name: "Send application" }).click();
  await expect(page).toHaveURL("/check-email");
  await expect(page.getByText("Then you can follow your application.")).toBeVisible();
  await expectHeldAtConfirm(page, ["/teach/pending", "/teach", "/account"]);

  await page.goto(await emailedLink(email, "teacher-application", "confirmUrl"));
  await expect(page).toHaveURL(/\/teach\/pending\?notice=email-confirmed/);
  await expect(page.getByRole("heading", { name: "Your application is with our team" })).toBeVisible();
  await logOut(page);

  await setEmailConfirmed(DEMO.admin, false);
  try {
    await logIn(page, DEMO.admin);
    await expect(page).toHaveURL(/\/check-email$/);
    await expectHeldAtConfirm(page, ["/admin", "/admin/people", "/account"]);
  } finally {
    await setEmailConfirmed(DEMO.admin, true);
  }
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin$/);
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
  // Following the reset link proved the inbox is theirs, so the account opens straight away.
  await expect(page).toHaveURL(/\/account\?notice=password-reset/);
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
