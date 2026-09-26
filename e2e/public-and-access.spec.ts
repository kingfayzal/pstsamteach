import { expect, test } from "@playwright/test";
import { DEMO, formAlert, logIn } from "./helpers";

test.describe("public site", () => {
  test("home page shows the promise and the three subjects", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Get it marked.");
    for (const subject of ["English", "Mathematics", "Nursing"]) {
      await expect(page.getByRole("link", { name: new RegExp(subject) }).first()).toBeVisible();
    }
  });

  test("catalog filters by subject and search", async ({ page }) => {
    await page.goto("/courses?subject=nursing");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Nursing");
    await expect(page.getByRole("link", { name: /Medication dosage calculations/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Algebra from the ground up/ })).toHaveCount(0);

    await page.goto("/courses");
    await page.getByLabel("Search courses").fill("algebra");
    await page.getByRole("button", { name: "Search" }).click();
    await expect(page.getByRole("link", { name: /Algebra from the ground up/ })).toBeVisible();
    await expect(page.getByText(/1 course matches/)).toBeVisible();
  });

  test("course page asks visitors to create an account", async ({ page }) => {
    await page.goto("/courses/medication-dosage-calculations");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Medication dosage calculations");
    await expect(page.getByRole("link", { name: "Create an account to enrol" })).toBeVisible();
  });

  test("drafts and courses in review are not public", async ({ page }) => {
    const response = await page.goto("/courses/writing-a-persuasive-essay");
    expect(response?.status()).toBe(404);
  });
});

test.describe("access control", () => {
  test("signed-out visitors are sent to log in, then back", async ({ page }) => {
    await page.goto("/teach");
    await expect(page).toHaveURL(/\/login\?next=%2Fteach/);
  });

  test("students can't reach the teacher or admin areas", async ({ page }) => {
    await logIn(page, DEMO.student);
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/learn$/);
    await page.goto("/teach");
    await expect(page).toHaveURL(/\/learn$/);
  });

  test("a wrong password gets a clear, non-specific error", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(DEMO.student);
    await page.getByLabel("Password").fill("definitely-wrong-1");
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(formAlert(page)).toHaveText("That email and password don't match an account.");
  });

  test("pending teachers only see their application", async ({ page }) => {
    await logIn(page, DEMO.applicant);
    await expect(page).toHaveURL(/\/teach\/pending$/);
    await page.goto("/teach/courses/new");
    await expect(page).toHaveURL(/\/teach\/pending$/);
  });

  test("security headers are set", async ({ request }) => {
    const response = await request.get("/");
    const headers = response.headers();
    expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["x-powered-by"]).toBeUndefined();
  });
});
