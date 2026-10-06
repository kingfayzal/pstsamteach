import { expect, type Page, test } from "@playwright/test";
import { DEMO, expectBrandShareImage, formAlert, logIn, useLagosTime } from "./helpers";

// A valid 1x1 transparent PNG.
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");

const teacherLink = (page: Page, name: string) => page.getByRole("heading", { level: 2, name });

test.describe("finding a teacher", () => {
  test.beforeEach(async ({ page }) => {
    await useLagosTime(page);
  });

  test("filters the directory by subject, topic, language and time", async ({ page }) => {
    await page.goto("/teachers?subject=nursing");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Nursing teachers");
    await expect(teacherLink(page, "Ruth Mensah")).toBeVisible();
    await expect(teacherLink(page, "Amaka Nwosu")).toBeVisible();
    await expect(teacherLink(page, "Daniel Okafor")).toHaveCount(0);

    await page.goto("/teachers?topic=dosage-calculations");
    await expect(teacherLink(page, "Ruth Mensah")).toBeVisible();
    await expect(teacherLink(page, "Amaka Nwosu")).toHaveCount(0);

    await page.goto("/teachers?language=Twi&subject=mathematics");
    await expect(teacherLink(page, "Kwame Asante")).toBeVisible();
    await expect(page.getByText("1 teacher matches.")).toBeVisible();

    // Saturday mornings in Lagos: Ruth (Accra, 09:00–13:00) and Grace (Lagos, 10:00–14:00), not weekday-only Daniel.
    await page.goto("/teachers?day=6&time=morning");
    await expect(teacherLink(page, "Ruth Mensah")).toBeVisible();
    await expect(teacherLink(page, "Grace Adeyemi")).toBeVisible();
    await expect(teacherLink(page, "Daniel Okafor")).toHaveCount(0);
  });

  test("a profile shows the teacher, their timetable and reviews", async ({ page }) => {
    await page.goto("/teachers/ruth-mensah");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Ruth Mensah");
    await expect(page.getByText("Approved by our team")).toBeVisible();
    await expect(page.getByRole("table")).toBeVisible();
    await expect(page.getByText("Shown in your time zone (Africa/Lagos).")).toBeVisible();
    await expect(page.getByText(/Ruth makes you check every answer/)).toBeVisible();
    await expect(page.getByRole("link", { name: "Choose Ruth as your teacher" })).toBeVisible();
  });
});

test("a student chooses a teacher, the teacher accepts, and they work together", async ({ browser }) => {
  const student = await browser.newPage();
  await useLagosTime(student);
  await logIn(student, "kemi@example.com");
  await student.goto("/teachers/amaka-nwosu");
  await student.getByRole("link", { name: "Choose Amaka as your teacher" }).click();
  await expect(student.getByRole("heading", { level: 1 })).toHaveText("Ask Amaka to be your teacher");

  await student.getByLabel("What do you want help with?").selectOption({ label: "Anatomy and physiology" });
  await student.getByLabel("Introduce yourself to Amaka").fill("First-year nursing student. The cardiovascular system is confusing me and my exam is next month.");
  const firstSlot = student.locator("fieldset fieldset label").first();
  const slotTime = (await firstSlot.textContent())?.trim() ?? "";
  await firstSlot.click();
  await student.getByRole("button", { name: "Send request to Amaka" }).click();
  await expect(student).toHaveURL(/\/learn\/teachers\/[^/?]+\?notice=request-sent/);
  await expect(student.getByText("Waiting for Amaka to reply.")).toBeVisible();
  await expect(student.getByText("Waiting for confirmation")).toBeVisible();
  const connectionUrl = student.url().split("?")[0];

  const teacher = await browser.newPage();
  await useLagosTime(teacher);
  await logIn(teacher, "amaka@example.com");
  await teacher.goto("/teach/students");
  await teacher.getByRole("listitem").filter({ hasText: "Kemi Balogun" }).getByRole("link", { name: "Review request" }).click();
  await expect(teacher.getByText(/cardiovascular system is confusing me/)).toBeVisible();
  await teacher.getByRole("button", { name: "Accept Kemi" }).click();
  await expect(teacher.getByText(/Accepted\. You're now working together/)).toBeVisible();
  await expect(teacher.getByText("Confirmed", { exact: true })).toBeVisible();

  // The student sees the confirmed session with a link to its video room, and they talk.
  await student.goto(connectionUrl);
  await expect(student.getByText("Working together")).toBeVisible();
  await expect(student.getByText(slotTime, { exact: false }).first()).toBeVisible();
  await expect(student.getByRole("link", { name: "Join the session" })).toHaveAttribute("href", /^\/sessions\/[a-z0-9]+$/);
  await student.getByLabel("Message Amaka").fill("Thank you! See you then.");
  await student.getByRole("button", { name: "Send message" }).click();
  await expect(student.getByText("Thank you! See you then.")).toBeVisible();

  await teacher.goto("/teach/students");
  await expect(teacher.getByText("1 new message")).toBeVisible();

  // Book another session.
  await student.goto(`${connectionUrl}/book`);
  await student.locator("fieldset fieldset label").nth(2).click();
  await student.getByLabel(/What would you like to work on/).fill("Heart sounds");
  await student.getByRole("button", { name: "Book this session" }).click();
  await expect(student).toHaveURL(/notice=session-booked/);
  await expect(student.getByText("To cover: Heart sounds")).toBeVisible();

  // Either side can cancel.
  const heartSounds = student.getByRole("listitem").filter({ hasText: "To cover: Heart sounds" });
  await heartSounds.getByText("Cancel", { exact: true }).click();
  await heartSounds.getByLabel("Reason (optional)").fill("Clash with a lecture");
  await heartSounds.getByRole("button", { name: "Cancel this session" }).click();
  await expect(student).toHaveURL(/notice=session-cancelled/);
});

test("a student with sessions can review their teacher", async ({ page }) => {
  await logIn(page, DEMO.student);
  await page.goto("/teachers/ruth-mensah");
  await page.getByText("5 stars", { exact: true }).click();
  await page.getByLabel("What's it like learning with Ruth?").fill("Liquid doses finally make sense. Ruth checks every step with you.");
  await page.getByRole("button", { name: "Post review" }).click();
  await expect(page.getByText(/Review saved/)).toBeVisible();
  await page.reload();
  await expect(page.getByRole("listitem").filter({ hasText: "Liquid doses finally make sense." })).toBeVisible();
  await expect(page.getByText("Ada O.")).toBeVisible();
});

test("students can shortlist teachers", async ({ page }) => {
  await logIn(page, "tomi@example.com");
  await page.goto("/teachers");
  await page.getByRole("listitem").filter({ has: teacherLink(page, "Kwame Asante") }).getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Saved to your shortlist.")).toBeVisible();
  await page.goto("/teachers?saved=1");
  await expect(teacherLink(page, "Kwame Asante")).toBeVisible();
  await expect(page.getByText("1 teacher matches.")).toBeVisible();
});

test("a teacher edits their profile, availability and photo", async ({ page, request }) => {
  await logIn(page, "blessing@example.com");
  await page.goto("/teach/profile");
  await page.getByLabel("Headline").fill("Speak English with confidence at work");
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByText("Profile saved.")).toBeVisible();

  await page.getByLabel("Add a photo").setInputFiles({ name: "me.png", mimeType: "image/png", buffer: PNG });
  await page.getByRole("button", { name: "Upload" }).click();
  await expect(page.getByText("Photo updated.")).toBeVisible();

  await page.goto("/teach/profile/availability");
  await page.getByRole("button", { name: "Weekends" }).click();
  await page.getByRole("button", { name: "Save availability" }).click();
  await expect(page.getByText("Availability saved.")).toBeVisible();

  await page.goto("/teachers/blessing-okoro");
  await expect(page.getByText("Speak English with confidence at work")).toBeVisible();
  const photo = page.getByRole("img", { name: "Photo of Blessing Okoro" });
  await expect(photo).toBeVisible();
  const src = await photo.getAttribute("src");
  const response = await request.get(src ?? "");
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toBe("image/png");
  // Sharing the profile still shows the logo, not the new photo.
  await expectBrandShareImage(page, request);

  // Non-images are refused.
  await page.goto("/teach/profile");
  await page.getByLabel("Change your photo").setInputFiles({ name: "evil.png", mimeType: "image/png", buffer: Buffer.from("<svg onload='alert(1)'></svg>") });
  await page.getByRole("button", { name: "Upload" }).click();
  await expect(formAlert(page).filter({ hasText: "Use a JPEG, PNG or WebP photo." })).toBeVisible();
});

test("an admin can hide a teacher from the directory", async ({ page, request }) => {
  page.on("dialog", (dialog) => dialog.accept());
  await logIn(page, DEMO.admin);
  await page.goto("/admin/teachers");
  await page.getByRole("row").filter({ hasText: "Yusuf Abdullahi" }).getByRole("button", { name: "Hide" }).click();
  await expect(page.getByText("Hidden from the directory.")).toBeVisible();

  const publicProfile = await request.get("/teachers/yusuf-abdullahi");
  expect(publicProfile.status()).toBe(404);
  const directory = await request.get("/teachers");
  expect(await directory.text()).not.toContain("Yusuf Abdullahi");
});
