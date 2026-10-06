import type { Resend } from "resend";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SITE } from "@/lib/site";
import { createLogTransport, createResendTransport, type OutgoingEmail } from "@/server/email/transport";

const EMAIL: OutgoingEmail = {
  to: "ada@example.com",
  subject: "Reset your Xcel Study password",
  html: "<p>Hi</p>",
  text: "Hi\nChoose a new password: https://www.xcelstudy.com/reset-password?token=abc",
  idempotencyKey: "email-123",
  kind: "password-reset",
};

const CONFIG = { apiKey: "re_test_key", from: "Xcel Study <hello@xcelstudy.com>", replyTo: null };

/** Just enough of the Resend client for the transport. */
function fakeClient(response: unknown) {
  const send = vi.fn().mockResolvedValue(response);
  return { client: { emails: { send } } as unknown as Resend, send };
}

afterEach(() => vi.restoreAllMocks());

describe("the Resend transport", () => {
  it("sends from the configured address, replies to support, and passes the idempotency key", async () => {
    const { client, send } = fakeClient({ data: { id: "re_abc" }, error: null });
    const result = await createResendTransport(CONFIG, client).send(EMAIL);
    expect(result).toEqual({ ok: true, id: "re_abc" });
    expect(send).toHaveBeenCalledWith(
      {
        from: CONFIG.from,
        to: "ada@example.com",
        replyTo: SITE.supportEmail,
        subject: EMAIL.subject,
        html: EMAIL.html,
        text: EMAIL.text,
        tags: [{ name: "kind", value: "password-reset" }],
      },
      { idempotencyKey: "email-123" },
    );
  });

  it("uses EMAIL_REPLY_TO when it's set", async () => {
    const { client, send } = fakeClient({ data: { id: "re_abc" }, error: null });
    await createResendTransport({ ...CONFIG, replyTo: "help@xcelstudy.com" }, client).send(EMAIL);
    expect(send.mock.calls[0][0]).toMatchObject({ replyTo: "help@xcelstudy.com" });
  });

  it("says whether a failure is worth retrying", async () => {
    const limited = fakeClient({ data: null, error: { name: "rate_limit_exceeded", message: "Too many requests", statusCode: 429 } });
    expect(await createResendTransport(CONFIG, limited.client).send(EMAIL)).toEqual({
      ok: false,
      retryable: true,
      error: "rate_limit_exceeded: Too many requests",
    });
    const invalid = fakeClient({ data: null, error: { name: "validation_error", message: "Invalid `to` field", statusCode: 422 } });
    expect(await createResendTransport(CONFIG, invalid.client).send(EMAIL)).toMatchObject({ ok: false, retryable: false });
  });
});

describe("the log stand-in", () => {
  it("prints the message, links included, outside production", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const transport = createLogTransport({});
    expect(transport.delivers).toBe(false);
    expect(await transport.send(EMAIL)).toEqual({ ok: true, id: "log-email-123" });
    expect(info.mock.calls[0][0]).toContain("reset-password?token=abc");
  });

  it("never prints the content on production, where links would sign people in", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await createLogTransport({ VERCEL_ENV: "production" }).send(EMAIL);
    expect(info).not.toHaveBeenCalled();
    expect(warn.mock.calls[0][0]).not.toContain("token");
    expect(warn.mock.calls[0][0]).toContain("isn't configured");
  });
});
