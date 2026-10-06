import { expect, test } from "@playwright/test";
import { emailedLink, formAlert } from "./helpers";

test("a new student signs up, learns, and passes a quiz", async ({ page }) => {
  const email = `e2e-${Date.now()}@example.com`;
  const secret = `stud-${Date.now()}-9x`;

  await page.goto("/signup");
  await page.getByLabel("Full name").fill("Test Student");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(secret);
  await page.getByRole("button", { name: "Create student account" }).click();
  await expect(page).toHaveURL("/check-email");

  // Confirming the address is the only way on.
  await page.goto(await emailedLink(email, "welcome", "confirmUrl"));
  await expect(page).toHaveURL(/\/learn\?notice=email-confirmed/);
  await expect(page.getByRole("status")).toContainText("Your account is ready");

  await page.goto("/courses/algebra-from-the-ground-up");
  await page.getByRole("button", { name: "Enrol in course" }).click();
  await expect(page).toHaveURL(/\/learn\/courses\/algebra-from-the-ground-up\?notice=enrolled/);

  await page.getByRole("link", { name: "Start first lesson" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Variables and expressions");
  await page.getByRole("button", { name: "Mark lesson as done" }).click();
  await expect(page.getByText("You’ve done this lesson")).toBeVisible();

  // The answer key must not reach the browser before the quiz is submitted.
  await page.goto("/learn/courses/algebra-from-the-ground-up");
  await page.getByRole("link", { name: "Solving equations" }).click();
  const html = await page.content();
  expect(html).not.toContain("Subtract 7 from both sides.");
  expect(html).not.toContain("isCorrect");

  // Submitting with a gap is refused.
  await page.getByRole("button", { name: "Submit answers" }).click();
  await expect(formAlert(page)).toContainText("Answer every question");

  const answers: Record<string, string> = {
    "Solve: x + 7 = 12": "5",
    "Solve: 3x = 21": "7",
    "Solve: 3x + 5 = 20": "5",
    "Simplify: 4a + 3b − a + 2b": "3a + 5b",
    "A number doubled, plus 4, is 18. What is the number?": "7",
  };
  for (const [prompt, answer] of Object.entries(answers)) {
    const group = page.getByRole("group", { name: prompt });
    await group.getByRole("radio", { name: answer, exact: true }).check();
  }
  await page.getByRole("button", { name: "Submit answers" }).click();
  await expect(page.getByText("Passed", { exact: true })).toBeVisible();
  await expect(page.getByLabel("5 out of 5, passed")).toBeVisible();

  await page.goto("/learn/grades");
  await expect(page.getByRole("link", { name: "Solving equations" })).toBeVisible();
});
