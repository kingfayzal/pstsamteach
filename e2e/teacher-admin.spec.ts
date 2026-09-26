import { expect, test } from "@playwright/test";
import { DEMO, formAlert, logIn, password } from "./helpers";

test("a teacher builds a course and an admin publishes it", async ({ browser }) => {
  const title = `Reading for meaning ${Date.now()}`;
  const teacher = await browser.newPage();
  await logIn(teacher, DEMO.english);

  await teacher.goto("/teach/courses/new");
  await teacher.getByLabel("Course title").fill(title);
  await teacher.getByLabel("One-line summary").fill("Read closely and pull out what a text really says.");
  await teacher.getByLabel("Subject").selectOption({ label: "English" });
  await teacher.getByLabel("Description").fill("Short.");
  await teacher.getByRole("button", { name: "Create draft" }).click();
  await expect(teacher.getByRole("status")).toContainText("Course created as a draft");

  // Not ready yet: no lessons, description too short.
  await expect(teacher.getByText(/Before you can submit/)).toBeVisible();
  await expect(teacher.getByRole("button", { name: "Submit for review" })).toHaveCount(0);

  await teacher.getByRole("link", { name: "Add lesson" }).click();
  await teacher.getByLabel("Lesson title").fill("Finding the main idea");
  await teacher.getByLabel("Lesson content").fill("## The main idea\n\nAsk: what is the writer trying to make me think?");
  await teacher.getByRole("button", { name: "Add lesson" }).click();
  await expect(teacher.getByRole("status")).toContainText("Lesson added");

  await teacher.getByRole("link", { name: "Details" }).click();
  await teacher
    .getByLabel("Description")
    .fill("This course teaches close reading: finding the main idea, spotting evidence, and noticing how a writer tries to persuade you.");
  await teacher.getByRole("button", { name: "Save details" }).click();
  await expect(teacher.getByText("Course details saved.")).toBeVisible();

  await teacher.getByRole("button", { name: "Submit for review" }).click();
  await expect(teacher.getByText(/Submitted for review/)).toBeVisible();

  const admin = await browser.newPage();
  await logIn(admin, DEMO.admin);
  await admin.goto("/admin/review");
  await admin.getByRole("listitem").filter({ hasText: title }).getByRole("link", { name: "Review course" }).click();
  await admin.getByRole("button", { name: "Approve and publish" }).click();
  await expect(admin.getByText(/Approved and published/)).toBeVisible();

  await admin.goto("/courses?subject=english");
  await expect(admin.getByRole("link", { name: new RegExp(title) })).toBeVisible();
  await admin.goto("/admin/activity");
  await expect(admin.getByText(`Approved and published: ${title}`)).toBeVisible();
});

test("a teacher marks an assignment and the student sees the result", async ({ browser }) => {
  const teacher = await browser.newPage();
  await logIn(teacher, DEMO.nursing);
  await teacher.goto("/teach/marking");
  await teacher.getByRole("listitem").filter({ hasText: "Ada Obi" }).getByRole("link", { name: "Mark" }).click();
  await teacher.getByLabel("Score out of 10").fill("9");
  await teacher.getByLabel("Feedback for the student").fill("Clear working and a sensible check.");
  await teacher.getByRole("button", { name: "Save mark" }).click();
  await expect(teacher).toHaveURL(/\/teach\/marking\?notice=marked/);

  const student = await browser.newPage();
  await logIn(student, DEMO.student);
  await student.goto("/learn/courses/medication-dosage-calculations");
  await student.getByRole("link", { name: "Talk through a calculation" }).click();
  await expect(student.getByLabel("9 out of 10, passed")).toBeVisible();
  await expect(student.getByText("Clear working and a sensible check.")).toBeVisible();
});

test("an admin approves a teacher and suspends a student", async ({ browser }) => {
  const admin = await browser.newPage();
  admin.on("dialog", (dialog) => dialog.accept());
  await logIn(admin, DEMO.admin);

  await admin.goto("/admin/review");
  await admin.getByRole("listitem").filter({ hasText: "Samuel Eze" }).getByRole("button", { name: "Approve as teacher" }).click();
  await expect(admin.getByText("Approved. They can create courses now.")).toBeVisible();

  await admin.goto("/admin/people?q=tobi");
  await admin.getByRole("link", { name: "Tobi Lawal" }).click();
  await admin.getByRole("button", { name: "Suspend account" }).click();
  await expect(admin.getByText("Suspended and signed out everywhere.")).toBeVisible();

  const suspended = await browser.newPage();
  await suspended.goto("/login");
  await suspended.getByLabel("Email").fill(DEMO.recentStudent);
  await suspended.getByLabel("Password").fill(password());
  await suspended.getByRole("button", { name: "Log in" }).click();
  await expect(formAlert(suspended)).toContainText("This account is suspended");

  const approved = await browser.newPage();
  await logIn(approved, DEMO.applicant);
  await expect(approved).toHaveURL(/\/teach$/);
});
