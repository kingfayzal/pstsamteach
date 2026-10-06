import { type Browser, expect, type Page, test } from "@playwright/test";
import pg from "pg";
import { DEMO, logIn, useLagosTime } from "./helpers";

const DATABASE_URL = process.env.E2E_DATABASE_URL ?? "postgresql://postgres@localhost:5432/pstsamteach_e2e";

let session: { id: string; connectionId: string };
/** Starts in five minutes, so its room is already open and it can still be cancelled. */
let soon: { id: string };

async function query<T extends pg.QueryResultRow>(text: string, values: unknown[]): Promise<T[]> {
  const client = new pg.Client({ connectionString: DATABASE_URL });
  await client.connect();
  try {
    return (await client.query<T>(text, values)).rows;
  } finally {
    await client.end();
  }
}

/** A session between Ada and Ruth that started five minutes ago, so its room is open. */
test.beforeAll(async () => {
  const [pair] = await query<{ connectionId: string; teacherId: string }>(
    `SELECT c.id AS "connectionId", c."teacherId" FROM "TeacherConnection" c
       JOIN "User" s ON s.id = c."studentId" JOIN "User" t ON t.id = c."teacherId"
      WHERE s.email = $1 AND t.email = $2 AND c.status = 'ACTIVE'`,
    [DEMO.student, DEMO.nursing],
  );
  const id = `e2elive${Date.now()}`;
  await query(
    `INSERT INTO "TutoringSession" (id, "connectionId", "teacherId", "startsAt", "endsAt", status, agenda, "updatedAt")
     VALUES ($1, $2, $3, now() - interval '5 minutes', now() + interval '55 minutes', 'CONFIRMED', 'Live room check', now())`,
    [id, pair.connectionId, pair.teacherId],
  );
  session = { id, connectionId: pair.connectionId };

  const soonId = `e2esoon${Date.now()}`;
  await query(
    `INSERT INTO "TutoringSession" (id, "connectionId", "teacherId", "startsAt", "endsAt", status, agenda, "updatedAt")
     VALUES ($1, $2, $3, now() + interval '5 minutes', now() + interval '65 minutes', 'CONFIRMED', 'Starting soon', now())`,
    [soonId, pair.connectionId, pair.teacherId],
  );
  soon = { id: soonId };
});

test.afterAll(async () => {
  await query(`DELETE FROM "TutoringSession" WHERE id = ANY($1)`, [[session?.id, soon?.id].filter(Boolean)]);
});

/** A separate browser profile per person. Chromium has a fake camera and microphone (see playwright.config.ts). */
async function newPerson(browser: Browser, viewport?: { width: number; height: number }): Promise<Page> {
  const context = await browser.newContext({ permissions: ["camera", "microphone"], ...(viewport ? { viewport } : {}) });
  return context.newPage();
}

test.describe("live sessions", () => {
  test("student and teacher meet, chat and leave in the session room", async ({ browser }) => {
    const ada = await newPerson(browser);
    const ruth = await newPerson(browser);
    await useLagosTime(ada);
    await useLagosTime(ruth);
    await logIn(ada, DEMO.student);
    await logIn(ruth, DEMO.nursing);

    // The dashboard links straight into the open room.
    await ada.goto("/learn");
    // Soonest first: the session that has already started.
    await ada.getByRole("link", { name: /^Join now, .+ session with Ruth Mensah$/ }).first().click();
    await expect(ada).toHaveURL(`/sessions/${session.id}`);
    await expect(ada.getByRole("heading", { level: 1, name: "Session with Ruth Mensah" })).toBeVisible();
    await expect(ada.getByText("To cover: Live room check")).toBeVisible();
    await expect(ada.getByRole("link", { name: "Use Ruth’s backup meeting link" })).toBeVisible();

    await ada.getByRole("button", { name: "Join the session" }).click();
    await expect(ada.getByText("Waiting for Ruth to join…")).toBeVisible();

    // The teacher comes in from the student's page; the soonest session is this one.
    await ruth.goto(`/teach/students/${session.connectionId}`);
    await ruth.getByRole("link", { name: "Join the session" }).first().click();
    await expect(ruth).toHaveURL(`/sessions/${session.id}`);
    await expect(ruth.getByRole("heading", { level: 1, name: "Session with Ada Obi" })).toBeVisible();
    await ruth.getByRole("button", { name: "Join the session" }).click();

    // Each sees the other's video tile, labelled with their name.
    await expect(ada.locator(".lk-participant-tile").filter({ hasText: "Ruth Mensah" })).toBeVisible();
    await expect(ruth.locator(".lk-participant-tile").filter({ hasText: "Ada Obi" })).toBeVisible();
    await expect(ada.getByText("Waiting for Ruth to join…")).toHaveCount(0);

    // In-call chat goes into their message thread, and the other side is told about it.
    await ruth.getByRole("button", { name: "Chat", exact: true }).click();
    await ruth.getByLabel("Message Ada").fill("Can you see the worked example?");
    await ruth.getByRole("button", { name: "Send", exact: true }).click();
    await expect(ruth.getByRole("complementary", { name: "Chat with Ada" }).getByText("Can you see the worked example?")).toBeVisible();
    await expect(ada.getByRole("button", { name: /^Chat\s*1 new$/ })).toBeVisible();
    await ada.getByRole("button", { name: /^Chat/ }).click();
    await expect(ada.getByRole("complementary", { name: "Chat with Ruth" }).getByText("Can you see the worked example?")).toBeVisible();

    await ada.getByRole("button", { name: "Leave" }).click();
    await expect(ada.getByRole("heading", { name: "You left the session." })).toBeVisible();
    await expect(ruth.getByText("Waiting for Ada to join…")).toBeVisible();

    // The chat message is saved in their ordinary thread.
    await ada.goto(`/learn/teachers/${session.connectionId}`);
    await expect(ada.getByRole("list", { name: "Messages with Ruth" }).getByText("Can you see the worked example?")).toBeVisible();

    await ada.context().close();
    await ruth.context().close();
  });

  test("cancelling a session that's about to start closes its room for whoever is in it", async ({ browser }) => {
    const ada = await newPerson(browser);
    await useLagosTime(ada);
    await logIn(ada, DEMO.student);
    await ada.goto(`/sessions/${soon.id}`);
    await ada.getByRole("button", { name: "Join the session" }).click();
    await expect(ada.getByText("Waiting for Ruth to join…")).toBeVisible();

    const ruth = await newPerson(browser);
    await useLagosTime(ruth);
    await logIn(ruth, DEMO.nursing);
    await ruth.goto(`/teach/students/${session.connectionId}`);
    const row = ruth.getByRole("listitem").filter({ hasText: "To cover: Starting soon" });
    await row.getByText("Cancel", { exact: true }).click();
    await row.getByRole("button", { name: "Cancel this session" }).click();

    await expect(ada.getByRole("heading", { name: "The room has closed." })).toBeVisible();
    await ada.context().close();
    await ruth.context().close();
  });

  test("on a phone, the controls stay on screen and the chat can be used from the keyboard", async ({ browser }) => {
    const ada = await newPerson(browser, { width: 390, height: 844 });
    await useLagosTime(ada);
    await logIn(ada, DEMO.student);
    await ada.goto(`/sessions/${session.id}`);
    await ada.getByRole("button", { name: "Join the session" }).click();
    await expect(ada.getByRole("button", { name: "Leave" })).toBeInViewport();

    const chat = ada.getByRole("button", { name: /^Chat/ });
    await chat.click();
    await expect(ada.getByLabel("Message Ruth")).toBeFocused();
    await ada.keyboard.press("Escape");
    await expect(ada.getByRole("complementary", { name: "Chat with Ruth" })).toBeHidden();
    await expect(chat).toBeFocused();

    await ada.getByRole("button", { name: "Leave" }).click();
    await expect(ada.getByRole("heading", { name: "You left the session." })).toBeVisible();
    await ada.context().close();
  });

  test("joining from a second tab moves the call there", async ({ browser }) => {
    const first = await newPerson(browser);
    await useLagosTime(first);
    await logIn(first, DEMO.student);
    await first.goto(`/sessions/${session.id}`);
    await first.getByRole("button", { name: "Join the session" }).click();
    await expect(first.getByText("Waiting for Ruth to join…")).toBeVisible();

    const second = await first.context().newPage();
    await second.goto(`/sessions/${session.id}`);
    await second.getByRole("button", { name: "Join the session" }).click();
    await expect(second.getByText("Waiting for Ruth to join…")).toBeVisible();
    await expect(first.getByRole("heading", { name: "You joined from another tab or device, so this window left the room." })).toBeVisible();

    await second.getByRole("button", { name: "Leave" }).click();
    await first.context().close();
  });

  test("nobody else can open the room", async ({ page }) => {
    await logIn(page, DEMO.english);
    const response = await page.goto(`/sessions/${session.id}`);
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("doesn’t exist, or you don’t have access to it");
  });

  test("only the room may use the camera and microphone", async ({ page }) => {
    await logIn(page, DEMO.student);
    const room = await page.goto(`/sessions/${session.id}`);
    expect(room?.headers()["permissions-policy"]).toContain("camera=(self)");
    expect(room?.headers()["content-security-policy"]).toContain("connect-src 'self' ws://127.0.0.1:7980 http://127.0.0.1:7980");
    const dashboard = await page.goto("/learn");
    expect(dashboard?.headers()["permissions-policy"]).toContain("camera=()");
  });
});
