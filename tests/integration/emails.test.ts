import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_SEND_ATTEMPTS } from "@/lib/email/delivery";
import { createSessionRecord } from "@/server/auth/session-store";
import { db } from "@/server/db";
import { deliverDueEmails, enqueueEmail, pruneEmailRecords } from "@/server/email/outbox";
import type { EmailTransport, OutgoingEmail, SendResult } from "@/server/email/transport";
import { applyToTeach, authenticate, changePassword, registerStudent } from "@/server/services/accounts";
import { approveTeacher, declineTeacher, reactivateUser, suspendUser } from "@/server/services/admin";
import { requestTeacher, respondToRequest } from "@/server/services/connections";
import { confirmEmail, resendConfirmationEmail } from "@/server/services/email-confirmation";
import { checkPasswordResetLink, requestPasswordReset, resetPassword } from "@/server/services/password-reset";
import { sendMessage } from "@/server/services/teacher-social";
import { bookSession } from "@/server/services/tutoring";
import { makeAdmin, makeStudent, makeSubject, makeTeacher, makeTeacherProfile, makeTopic, makeUser, resetDb, TEST_PASSWORD } from "./factories";

beforeEach(resetDb);

const NOW = new Date("2026-09-27T12:00:00Z");
const MINUTE = 60 * 1000;
const LINK = "https://www.xcelstudy.com/somewhere";
const NEW_PASSWORD = `new-${TEST_PASSWORD}`;

/** A transport that records what it was asked to send and answers from a script (then succeeds). */
function fakeTransport(script: (SendResult | Error)[] = [], delivers = true) {
  const sent: OutgoingEmail[] = [];
  const transport: EmailTransport = {
    delivers,
    async send(email) {
      sent.push(email);
      const next = script.shift() ?? { ok: true, id: `re_${sent.length}` };
      if (next instanceof Error) throw next;
      return next;
    },
  };
  return { sent, transport };
}

const queued = (where: { kind?: string; toEmail?: string } = {}) => db.emailOutbox.findMany({ where, orderBy: { createdAt: "asc" } });

async function onlyEmail(kind: string, toEmail: string) {
  const rows = await queued({ kind, toEmail });
  expect(rows).toHaveLength(1);
  return rows[0];
}

/** The token inside a queued email's link. */
function tokenIn(payload: unknown, field: string): string {
  const url = new URL((payload as Record<string, string>)[field]);
  return url.searchParams.get("token") ?? "";
}

describe("the outbox", () => {
  it("queues an email only if the surrounding change commits", async () => {
    await expect(
      db.$transaction(async (tx) => {
        await enqueueEmail(tx, { now: NOW, to: "a@example.com", message: { kind: "account-suspended", data: { name: "Ada" } } });
        throw new Error("roll back");
      }),
    ).rejects.toThrow("roll back");
    expect(await queued()).toHaveLength(0);
  });

  it("refuses data its template doesn't accept, so the mistake fails the change", async () => {
    await expect(
      enqueueEmail(db, { now: NOW, to: "a@example.com", message: { kind: "password-reset", data: { name: "Ada", resetUrl: "javascript:alert(1)" } } }),
    ).rejects.toThrow(/password-reset/);
  });

  it("sends the rendered email once, with an idempotency key, and forgets sign-in links afterwards", async () => {
    const reset = await enqueueEmail(db, { now: NOW, to: "ada@example.com", message: { kind: "password-reset", data: { name: "Ada Obi", resetUrl: LINK } } });
    const notice = await enqueueEmail(db, { now: NOW, to: "ada@example.com", message: { kind: "account-suspended", data: { name: "Ada Obi" } } });
    const { sent, transport } = fakeTransport();

    expect(await deliverDueEmails(transport, { now: NOW })).toEqual({ sent: 2, retrying: 0, failed: 0, expired: 0 });
    expect(sent).toHaveLength(2);
    expect(sent[0]).toMatchObject({ to: "ada@example.com", subject: "Reset your Xcel Study password", idempotencyKey: `email-${reset.id}`, kind: "password-reset" });
    expect(sent[0].html).toContain(LINK);
    expect(sent[0].text).toContain(`Choose a new password: ${LINK}`);

    const rows = await db.emailOutbox.findMany({ where: { id: { in: [reset.id, notice.id] } } });
    const byId = Object.fromEntries(rows.map((r) => [r.id, r]));
    expect(byId[reset.id]).toMatchObject({ status: "SENT", providerId: "re_1", attempts: 1, payload: {} });
    expect(byId[notice.id]).toMatchObject({ status: "SENT", payload: { name: "Ada Obi" } });

    expect(await deliverDueEmails(transport, { now: NOW })).toEqual({ sent: 0, retrying: 0, failed: 0, expired: 0 });
  });

  it("keeps the stored copy when nothing really went out (the log stand-in)", async () => {
    await enqueueEmail(db, { now: NOW, to: "ada@example.com", message: { kind: "password-reset", data: { name: "Ada", resetUrl: LINK } } });
    await deliverDueEmails(fakeTransport([], false).transport, { now: NOW });
    expect((await queued())[0]).toMatchObject({ status: "SENT", payload: { resetUrl: LINK } });
  });

  it("retries a temporary failure later, not straight away", async () => {
    await enqueueEmail(db, { now: NOW, to: "ada@example.com", message: { kind: "account-suspended", data: { name: "Ada" } } });
    const { sent, transport } = fakeTransport([{ ok: false, retryable: true, error: "rate_limit_exceeded: slow down" }]);

    expect(await deliverDueEmails(transport, { now: NOW })).toMatchObject({ retrying: 1 });
    const waiting = (await queued())[0];
    expect(waiting).toMatchObject({ status: "PENDING", attempts: 1, lastError: "rate_limit_exceeded: slow down" });
    expect(waiting.sendAfter.getTime()).toBeGreaterThan(NOW.getTime());

    expect(await deliverDueEmails(transport, { now: NOW })).toMatchObject({ sent: 0 });
    expect(await deliverDueEmails(transport, { now: new Date(waiting.sendAfter.getTime() + 1) })).toMatchObject({ sent: 1 });
    expect(sent).toHaveLength(2);
    expect((await queued())[0]).toMatchObject({ status: "SENT", attempts: 2, lastError: null });
  });

  it("treats a thrown error as temporary", async () => {
    await enqueueEmail(db, { now: NOW, to: "ada@example.com", message: { kind: "account-suspended", data: { name: "Ada" } } });
    expect(await deliverDueEmails(fakeTransport([new Error("socket hang up")]).transport, { now: NOW })).toMatchObject({ retrying: 1 });
    expect((await queued())[0].lastError).toBe("socket hang up");
  });

  it("gives up at once on a message that can never be sent, and forgets its link", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    await enqueueEmail(db, { now: NOW, to: "ada@example.com", message: { kind: "password-reset", data: { name: "Ada", resetUrl: LINK } } });
    const report = await deliverDueEmails(fakeTransport([{ ok: false, retryable: false, error: "validation_error: bad address" }]).transport, { now: NOW });
    expect(report).toMatchObject({ failed: 1 });
    expect((await queued())[0]).toMatchObject({ status: "FAILED", payload: {}, lastError: "validation_error: bad address" });
    vi.restoreAllMocks();
  });

  it("gives up after the last retry", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    await enqueueEmail(db, { now: NOW, to: "ada@example.com", message: { kind: "account-suspended", data: { name: "Ada" } } });
    const failure: SendResult = { ok: false, retryable: true, error: "internal_server_error: down" };
    const { sent, transport } = fakeTransport(Array.from({ length: MAX_SEND_ATTEMPTS }, () => failure));
    let now = NOW;
    for (let i = 0; i < MAX_SEND_ATTEMPTS; i++) {
      await deliverDueEmails(transport, { now });
      now = new Date(now.getTime() + 24 * 60 * MINUTE);
    }
    expect(sent).toHaveLength(MAX_SEND_ATTEMPTS);
    expect((await queued())[0]).toMatchObject({ status: "FAILED", attempts: MAX_SEND_ATTEMPTS });
    vi.restoreAllMocks();
  });

  it("drops an email whose link expired before it could go", async () => {
    await enqueueEmail(db, {
      now: NOW,
      to: "ada@example.com",
      expiresAt: new Date(NOW.getTime() - MINUTE),
      message: { kind: "password-reset", data: { name: "Ada", resetUrl: LINK } },
    });
    const { sent, transport } = fakeTransport();
    expect(await deliverDueEmails(transport, { now: NOW })).toMatchObject({ expired: 1 });
    expect(sent).toHaveLength(0);
    expect((await queued())[0]).toMatchObject({ status: "CANCELLED", payload: {} });
  });

  it("fails a stored email that no longer matches its template", async () => {
    await db.emailOutbox.create({ data: { kind: "retired-kind", toEmail: "ada@example.com", payload: {}, sendAfter: NOW } });
    expect(await deliverDueEmails(fakeTransport().transport, { now: NOW })).toMatchObject({ failed: 1 });
  });

  it("never sends the same email from two senders running at once", async () => {
    for (let i = 0; i < 6; i++) {
      await enqueueEmail(db, { now: NOW, to: `user${i}@example.com`, message: { kind: "account-suspended", data: { name: `User ${i}` } } });
    }
    const sent: string[] = [];
    const slow: EmailTransport = {
      delivers: true,
      async send(email) {
        sent.push(email.idempotencyKey);
        await new Promise((resolve) => setTimeout(resolve, 20));
        return { ok: true, id: email.idempotencyKey };
      },
    };
    await Promise.all([deliverDueEmails(slow, { now: NOW }), deliverDueEmails(slow, { now: NOW }), deliverDueEmails(slow, { now: NOW })]);
    expect(sent).toHaveLength(6);
    expect(new Set(sent).size).toBe(6);
  });

  it("picks up an email whose sender died mid-send once the lease runs out", async () => {
    const { id } = await enqueueEmail(db, { now: NOW, to: "ada@example.com", message: { kind: "account-suspended", data: { name: "Ada" } } });
    await db.emailOutbox.update({ where: { id }, data: { status: "SENDING", attempts: 1, lockedUntil: new Date(NOW.getTime() + MINUTE) } });
    expect(await deliverDueEmails(fakeTransport().transport, { now: NOW })).toMatchObject({ sent: 0 });
    expect(await deliverDueEmails(fakeTransport().transport, { now: new Date(NOW.getTime() + 2 * MINUTE) })).toMatchObject({ sent: 1 });
  });

  it("clears out expired links and old finished email", async () => {
    const user = await makeStudent();
    const longAgo = new Date(NOW.getTime() - 100 * 24 * 60 * MINUTE);
    await db.accountToken.create({ data: { id: "old", userId: user.id, email: user.email, purpose: "RESET_PASSWORD", expiresAt: longAgo } });
    await db.accountToken.create({ data: { id: "live", userId: user.id, email: user.email, purpose: "RESET_PASSWORD", expiresAt: NOW } });
    const old = await db.emailOutbox.create({ data: { kind: "account-suspended", toEmail: user.email, payload: {}, status: "SENT" } });
    await db.$executeRaw`UPDATE "EmailOutbox" SET "updatedAt" = ${longAgo} WHERE "id" = ${old.id}`;
    await db.emailOutbox.create({ data: { kind: "account-suspended", toEmail: user.email, payload: {}, status: "PENDING" } });

    expect(await pruneEmailRecords(NOW)).toEqual({ tokens: 1, emails: 1 });
    expect(await db.accountToken.findMany({ select: { id: true } })).toEqual([{ id: "live" }]);
    expect(await db.emailOutbox.count()).toBe(1);
  });
});

describe("confirming an email address", () => {
  it("sends new students a welcome email with a link that confirms the address", async () => {
    const created = await registerStudent({ name: "Ada Obi", email: "ada@example.com", password: TEST_PASSWORD }, NOW);
    if (!created.ok) throw new Error(created.message);
    expect(await db.user.findUniqueOrThrow({ where: { id: created.data.id } })).toMatchObject({ emailVerifiedAt: null });

    const email = await onlyEmail("welcome", "ada@example.com");
    expect(email).toMatchObject({ userId: created.data.id, payload: { name: "Ada Obi" } });
    expect(email.expiresAt?.getTime()).toBe(NOW.getTime() + 3 * 24 * 60 * MINUTE);
    const token = tokenIn(email.payload, "confirmUrl");
    expect(new URL((email.payload as { confirmUrl: string }).confirmUrl).pathname).toBe("/confirm-email");

    expect(await confirmEmail(token, new Date(NOW.getTime() + MINUTE))).toEqual({ ok: true, data: "confirmed" });
    expect((await db.user.findUniqueOrThrow({ where: { id: created.data.id } })).emailVerifiedAt).toEqual(new Date(NOW.getTime() + MINUTE));
    // A mail scanner may have opened it first: following it again still reads as success.
    expect(await confirmEmail(token, new Date(NOW.getTime() + 2 * MINUTE))).toEqual({ ok: true, data: "already-confirmed" });
  });

  it("names the subject in a teacher's application email", async () => {
    const subject = await makeSubject({ name: "Mathematics" });
    const applied = await applyToTeach(
      { name: "Samuel Eze", email: "samuel@example.com", password: TEST_PASSWORD, subjectId: subject.id, applicationNote: "x".repeat(60) },
      NOW,
    );
    expect(applied.ok).toBe(true);
    expect((await onlyEmail("teacher-application", "samuel@example.com")).payload).toMatchObject({ subjectName: "Mathematics" });
  });

  it("refuses links that are made up, expired, or for an address the account no longer has", async () => {
    const created = await registerStudent({ name: "Ada", email: "ada@example.com", password: TEST_PASSWORD }, NOW);
    if (!created.ok) throw new Error(created.message);
    const token = tokenIn((await onlyEmail("welcome", "ada@example.com")).payload, "confirmUrl");

    expect(await confirmEmail("not-a-token", NOW)).toMatchObject({ ok: false, code: "INVALID" });
    expect(await confirmEmail(undefined, NOW)).toMatchObject({ ok: false, code: "INVALID" });
    expect(await confirmEmail(token, new Date(NOW.getTime() + 4 * 24 * 60 * MINUTE))).toMatchObject({ ok: false, code: "INVALID" });

    await db.user.update({ where: { id: created.data.id }, data: { email: "new@example.com" } });
    expect(await confirmEmail(token, NOW)).toMatchObject({ ok: false, code: "INVALID" });
    expect((await db.user.findUniqueOrThrow({ where: { id: created.data.id } })).emailVerifiedAt).toBeNull();
  });

  it("sends a fresh link on request, but not to a confirmed or suspended account", async () => {
    const student = await makeUser({ confirmed: false, name: "Ada Obi" });
    expect(await resendConfirmationEmail(student, NOW)).toEqual({ ok: true, data: { email: student.email } });
    const email = await onlyEmail("confirm-email", student.email);
    expect(await confirmEmail(tokenIn(email.payload, "confirmUrl"), NOW)).toEqual({ ok: true, data: "confirmed" });

    expect(await resendConfirmationEmail(student, NOW)).toMatchObject({ ok: false, code: "CONFLICT" });
    const suspended = await makeUser({ confirmed: false, status: "SUSPENDED" });
    expect(await resendConfirmationEmail(suspended, NOW)).toMatchObject({ ok: false, code: "FORBIDDEN" });
  });
});

describe("resetting a password", () => {
  it("answers the same for unknown and suspended addresses, and emails nothing", async () => {
    const suspended = await makeUser({ status: "SUSPENDED" });
    expect(await requestPasswordReset({ email: "nobody@example.com" }, NOW)).toEqual({ ok: true, data: null });
    expect(await requestPasswordReset({ email: suspended.email }, NOW)).toEqual({ ok: true, data: null });
    expect(await queued()).toHaveLength(0);
    expect(await requestPasswordReset({ email: "not an email" }, NOW)).toMatchObject({ ok: false, code: "INVALID" });
  });

  it("sets a new password from the emailed link, once, and signs out every device", async () => {
    const student = await makeUser({ confirmed: false, email: "ada@example.com", name: "Ada Obi" });
    await createSessionRecord(student.id);
    expect(await requestPasswordReset({ email: "ADA@example.com " }, NOW)).toEqual({ ok: true, data: null });
    expect(await requestPasswordReset({ email: "ada@example.com" }, NOW)).toEqual({ ok: true, data: null });
    const [first, second] = await queued({ kind: "password-reset" });
    expect(first.expiresAt?.getTime()).toBe(NOW.getTime() + 60 * MINUTE);
    const token = tokenIn(second.payload, "resetUrl");

    expect(await checkPasswordResetLink(token, NOW)).toEqual({ name: "Ada Obi" });
    const mismatch = await resetPassword({ token, newPassword: NEW_PASSWORD, confirmPassword: "different-1" }, NOW);
    expect(mismatch).toMatchObject({ ok: false, code: "INVALID", errors: { confirmPassword: expect.any(Array) } });

    const done = await resetPassword({ token, newPassword: NEW_PASSWORD, confirmPassword: NEW_PASSWORD }, NOW);
    expect(done).toMatchObject({ ok: true, data: { id: student.id, email: "ada@example.com" } });
    expect(await authenticate({ email: "ada@example.com", password: NEW_PASSWORD })).toMatchObject({ ok: true });
    expect(await authenticate({ email: "ada@example.com", password: TEST_PASSWORD })).toMatchObject({ ok: false });
    expect(await db.session.count({ where: { userId: student.id } })).toBe(0);
    // Following the link proved they read this inbox.
    expect((await db.user.findUniqueOrThrow({ where: { id: student.id } })).emailVerifiedAt).toEqual(NOW);
    expect(await onlyEmail("password-changed", "ada@example.com")).toBeTruthy();

    // That link, and the earlier one, are spent.
    expect(await checkPasswordResetLink(token, NOW)).toBeNull();
    const again = await resetPassword({ token: tokenIn(first.payload, "resetUrl"), newPassword: "another-pass-1", confirmPassword: "another-pass-1" }, NOW);
    expect(again).toMatchObject({ ok: false, code: "INVALID" });
  });

  it("refuses an expired link, and one for a suspended account", async () => {
    const student = await makeUser({ email: "ada@example.com" });
    await requestPasswordReset({ email: student.email }, NOW);
    const token = tokenIn((await onlyEmail("password-reset", student.email)).payload, "resetUrl");
    const later = new Date(NOW.getTime() + 61 * MINUTE);
    expect(await checkPasswordResetLink(token, later)).toBeNull();
    expect(await resetPassword({ token, newPassword: NEW_PASSWORD, confirmPassword: NEW_PASSWORD }, later)).toMatchObject({ ok: false, code: "INVALID" });

    await db.user.update({ where: { id: student.id }, data: { status: "SUSPENDED" } });
    expect(await checkPasswordResetLink(token, NOW)).toBeNull();
  });

  it("tells the owner when their password is changed from the account page", async () => {
    const student = await makeUser({ email: "ada@example.com", name: "Ada Obi" });
    const changed = await changePassword(student, { currentPassword: TEST_PASSWORD, newPassword: NEW_PASSWORD, confirmPassword: NEW_PASSWORD });
    expect(changed.ok).toBe(true);
    const email = await onlyEmail("password-changed", "ada@example.com");
    expect(new URL((email.payload as { resetUrl: string }).resetUrl).pathname).toBe("/forgot-password");
  });
});

describe("account decisions by the platform team", () => {
  it("emails teachers about their application, and anyone suspended or restored", async () => {
    const admin = await makeAdmin();
    const [approved, declined, member] = await Promise.all([
      makeUser({ role: "TEACHER", status: "PENDING", email: "approved@example.com" }),
      makeUser({ role: "TEACHER", status: "PENDING", email: "declined@example.com" }),
      makeStudent(),
    ]);
    expect((await approveTeacher(admin, approved.id)).ok).toBe(true);
    expect((await declineTeacher(admin, declined.id)).ok).toBe(true);
    expect((await suspendUser(admin, member.id, NOW, null)).ok).toBe(true);
    expect((await reactivateUser(admin, member.id)).ok).toBe(true);

    expect(new URL(((await onlyEmail("teacher-approved", approved.email)).payload as { profileUrl: string }).profileUrl).pathname).toBe("/teach/profile");
    expect(await onlyEmail("teacher-declined", declined.email)).toBeTruthy();
    expect(await onlyEmail("account-suspended", member.email)).toBeTruthy();
    expect(await onlyEmail("account-reactivated", member.email)).toBeTruthy();
  });

  it("emails nobody when the decision is refused", async () => {
    const admin = await makeAdmin();
    const student = await makeStudent();
    expect((await approveTeacher(admin, student.id)).ok).toBe(false);
    expect(await queued()).toHaveLength(0);
  });
});

describe("confirm before requesting, booking or messaging", () => {
  const GOALS = "I'm preparing for my licensing exam and keep getting dosage questions wrong.";

  async function listedTeacher() {
    const subject = await makeSubject({ name: `Nursing ${Math.random()}` });
    const topic = await makeTopic(subject.id, "Dosage calculations");
    const teacher = await makeTeacher();
    await makeTeacherProfile(teacher.id, { topicIds: [topic.id] });
    return teacher;
  }

  const unconfirm = (id: string) => db.user.update({ where: { id }, data: { emailVerifiedAt: null } });

  it("stops an unconfirmed student asking for a teacher, and says how to fix it", async () => {
    const teacher = await listedTeacher();
    const student = await makeUser({ confirmed: false, email: "new@example.com" });
    const result = await requestTeacher(student, teacher.id, { goals: GOALS }, NOW);
    expect(result).toMatchObject({ ok: false, code: "FORBIDDEN" });
    expect(!result.ok && result.message).toContain("new@example.com");
    expect(await db.teacherConnection.count()).toBe(0);
  });

  it("stops booking and messaging until the address is confirmed", async () => {
    const teacher = await listedTeacher();
    const student = await makeStudent();
    const request = await requestTeacher(student, teacher.id, { goals: GOALS }, NOW);
    if (!request.ok) throw new Error(request.message);
    expect((await respondToRequest(teacher, request.data.connectionId, true, {}, NOW)).ok).toBe(true);

    await unconfirm(student.id);
    expect(await bookSession(student, request.data.connectionId, { slotStart: "2026-09-28T17:00:00.000Z" }, NOW)).toMatchObject({ ok: false, code: "FORBIDDEN" });
    expect(await sendMessage(student, request.data.connectionId, { body: "Hello" })).toMatchObject({ ok: false, code: "FORBIDDEN" });
    expect((await sendMessage(teacher, request.data.connectionId, { body: "Hello" })).ok).toBe(true);
  });

  it("lets an unconfirmed teacher decline a request, but not accept one", async () => {
    const teacher = await listedTeacher();
    const [first, second] = [await makeStudent(), await makeStudent()];
    const a = await requestTeacher(first, teacher.id, { goals: GOALS }, NOW);
    const b = await requestTeacher(second, teacher.id, { goals: GOALS }, NOW);
    if (!a.ok || !b.ok) throw new Error("request failed");
    await unconfirm(teacher.id);
    expect(await respondToRequest(teacher, a.data.connectionId, true, {}, NOW)).toMatchObject({ ok: false, code: "FORBIDDEN" });
    expect(await respondToRequest(teacher, b.data.connectionId, false, { note: "Fully booked this term." }, NOW)).toMatchObject({ ok: true });
  });
});

describe("the daily email job", () => {
  const saved = process.env.CRON_SECRET;
  afterEach(() => {
    if (saved === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = saved;
  });

  async function call(authorization?: string) {
    const { GET } = await import("@/app/api/cron/emails/route");
    return GET(new Request("http://localhost/api/cron/emails", { headers: authorization ? { authorization } : {} }));
  }

  it("refuses to run without the shared secret", async () => {
    delete process.env.CRON_SECRET;
    expect((await call("Bearer anything")).status).toBe(401);
    process.env.CRON_SECRET = "cron-secret-for-tests";
    expect((await call()).status).toBe(401);
    expect((await call("Bearer wrong")).status).toBe(401);
  });

  it("sends what's due and reports what it did", async () => {
    process.env.CRON_SECRET = "cron-secret-for-tests";
    vi.spyOn(console, "info").mockImplementation(() => {});
    await enqueueEmail(db, { now: NOW, to: "ada@example.com", message: { kind: "account-suspended", data: { name: "Ada" } } });
    const response = await call("Bearer cron-secret-for-tests");
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ delivered: { sent: 1 }, pruned: { tokens: 0, emails: 0 } });
    expect((await queued())[0].status).toBe("SENT");
    vi.restoreAllMocks();
  });
});
