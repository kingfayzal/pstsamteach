import { describe, expect, it } from "vitest";
import { appOrigin, assertEmailReadyForDeploy, parseEmailConfig } from "@/lib/email/config";
import { isRetryableResendError, MAX_SEND_ATTEMPTS, retryDelayMs } from "@/lib/email/delivery";
import { escapeHtml, toHtml, toText } from "@/lib/email/layout";
import { EMAIL_KINDS, type EmailMessage, isSensitiveKind, parseEmailMessage, renderEmail } from "@/lib/email/templates";
import { SITE } from "@/lib/site";

const KEY = "re_test_0123456789abcdef";

describe("parseEmailConfig", () => {
  it("is off when nothing is set", () => {
    expect(parseEmailConfig({})).toBeNull();
    expect(parseEmailConfig({ RESEND_API_KEY: " ", EMAIL_FROM: "" })).toBeNull();
  });

  it("reads the key, sender and optional reply-to address", () => {
    expect(parseEmailConfig({ RESEND_API_KEY: KEY, EMAIL_FROM: "Xcel Study <hello@xcelstudy.com>" })).toEqual({
      apiKey: KEY,
      from: "Xcel Study <hello@xcelstudy.com>",
      replyTo: null,
    });
    expect(parseEmailConfig({ RESEND_API_KEY: KEY, EMAIL_FROM: "hello@xcelstudy.com", EMAIL_REPLY_TO: "help@xcelstudy.com" })).toEqual({
      apiKey: KEY,
      from: "hello@xcelstudy.com",
      replyTo: "help@xcelstudy.com",
    });
  });

  it("refuses half a setup, so a deploy fails instead of silently not sending", () => {
    expect(() => parseEmailConfig({ RESEND_API_KEY: KEY })).toThrow(/EMAIL_FROM/);
    expect(() => parseEmailConfig({ EMAIL_FROM: "hello@xcelstudy.com" })).toThrow(/RESEND_API_KEY/);
  });

  it("refuses a key that isn't a Resend key, without echoing it", () => {
    expect(() => parseEmailConfig({ RESEND_API_KEY: "sk_live_secret", EMAIL_FROM: "hello@xcelstudy.com" })).toThrow(/re_/);
    expect(() => parseEmailConfig({ RESEND_API_KEY: "sk_live_secret", EMAIL_FROM: "hello@xcelstudy.com" })).not.toThrow(/sk_live_secret/);
  });

  it("refuses a sender Resend can't send from", () => {
    expect(() => parseEmailConfig({ RESEND_API_KEY: KEY, EMAIL_FROM: "not an address" })).toThrow(/EMAIL_FROM/);
    expect(() => parseEmailConfig({ RESEND_API_KEY: KEY, EMAIL_FROM: "Xcel <xcelstudy5@gmail.com>" })).toThrow(/gmail\.com/);
    expect(() => parseEmailConfig({ RESEND_API_KEY: KEY, EMAIL_FROM: "hello@xcelstudy.com", EMAIL_REPLY_TO: "nope" })).toThrow(/EMAIL_REPLY_TO/);
  });
});

describe("assertEmailReadyForDeploy", () => {
  it("requires email on production deploys only", () => {
    expect(() => assertEmailReadyForDeploy({ VERCEL_ENV: "production" })).toThrow(/RESEND_API_KEY/);
    expect(() => assertEmailReadyForDeploy({ VERCEL_ENV: "production", RESEND_API_KEY: KEY, EMAIL_FROM: "hello@xcelstudy.com" })).not.toThrow();
    expect(() => assertEmailReadyForDeploy({ VERCEL_ENV: "preview" })).not.toThrow();
    expect(() => assertEmailReadyForDeploy({})).not.toThrow();
  });
});

describe("appOrigin", () => {
  it("prefers APP_URL, trimmed to its origin", () => {
    expect(appOrigin({ APP_URL: "https://staging.xcelstudy.com/some/path", VERCEL_ENV: "production" })).toBe("https://staging.xcelstudy.com");
  });

  it("uses Vercel's production domain on production and the branch address on previews", () => {
    expect(appOrigin({ VERCEL_ENV: "production", VERCEL_PROJECT_PRODUCTION_URL: "www.xcelstudy.com" })).toBe("https://www.xcelstudy.com");
    expect(appOrigin({ VERCEL_ENV: "preview", VERCEL_BRANCH_URL: "app-git-dev.vercel.app", VERCEL_URL: "app-abc.vercel.app" })).toBe(
      "https://app-git-dev.vercel.app",
    );
    expect(appOrigin({ VERCEL_ENV: "preview", VERCEL_URL: "app-abc.vercel.app" })).toBe("https://app-abc.vercel.app");
  });

  it("falls back to the site's own address in production and localhost elsewhere", () => {
    expect(appOrigin({ VERCEL_ENV: "production" })).toBe(SITE.url);
    expect(appOrigin({})).toBe("http://localhost:3000");
  });

  it("refuses an APP_URL that isn't http(s)", () => {
    expect(() => appOrigin({ APP_URL: "javascript:alert(1)" })).toThrow(/APP_URL/);
  });
});

describe("retries", () => {
  it("backs off longer each time, then gives up", () => {
    const delays = Array.from({ length: MAX_SEND_ATTEMPTS - 1 }, (_, i) => retryDelayMs(i + 1));
    expect(delays.every((d) => d !== null && d > 0)).toBe(true);
    for (let i = 1; i < delays.length; i++) expect(delays[i]!).toBeGreaterThan(delays[i - 1]!);
    expect(retryDelayMs(MAX_SEND_ATTEMPTS)).toBeNull();
  });

  it("retries Resend's temporary failures but not bad requests", () => {
    for (const name of ["rate_limit_exceeded", "daily_quota_exceeded", "internal_server_error", "application_error", "invalid_api_key", "concurrent_idempotent_requests"]) {
      expect(isRetryableResendError(name)).toBe(true);
    }
    for (const name of ["validation_error", "invalid_from_address", "missing_required_field", "invalid_idempotent_request"]) {
      expect(isRetryableResendError(name)).toBe(false);
    }
  });
});

const URL_ = "https://www.xcelstudy.com/confirm-email?token=abc";

const SAMPLES: EmailMessage[] = [
  { kind: "welcome", data: { name: "Ada Obi", confirmUrl: URL_ } },
  { kind: "teacher-application", data: { name: "Samuel Eze", confirmUrl: URL_, subjectName: "Mathematics" } },
  { kind: "confirm-email", data: { name: "Ada Obi", confirmUrl: URL_ } },
  { kind: "password-reset", data: { name: "Ada Obi", resetUrl: URL_ } },
  { kind: "password-changed", data: { name: "Ada Obi", resetUrl: URL_ } },
  { kind: "teacher-approved", data: { name: "Samuel Eze", profileUrl: URL_ } },
  { kind: "teacher-declined", data: { name: "Samuel Eze", learnUrl: URL_ } },
  { kind: "account-suspended", data: { name: "Ada Obi" } },
  { kind: "account-reactivated", data: { name: "Ada Obi", loginUrl: URL_ } },
];

describe("templates", () => {
  it("has a sample for every kind", () => {
    expect(SAMPLES.map((s) => s.kind).sort()).toEqual([...EMAIL_KINDS].sort());
  });

  it.each(SAMPLES)("$kind reads as a plain, complete message", (message) => {
    const content = renderEmail(message);
    expect(content.subject.length).toBeGreaterThan(10);
    expect(content.subject).not.toMatch(/[A-Z]{4,}/);
    expect(content.preview.length).toBeGreaterThan(10);
    expect(content.greeting).toBe(`Hi ${message.data.name.split(" ")[0]},`);
    expect(content.paragraphs.length).toBeGreaterThan(0);
    if (content.action) {
      expect(content.action.url).toBe(URL_);
      expect(content.action.label).not.toMatch(/[→>]/);
    }
    expect(content.footer).toContain(SITE.supportEmail);
  });

  it("explains how long links last", () => {
    expect(renderEmail(SAMPLES[0]).smallPrint.join(" ")).toMatch(/3 days/);
    expect(renderEmail(SAMPLES[3]).smallPrint.join(" ")).toMatch(/one hour/);
  });

  it("names the subject in a teacher application", () => {
    expect(renderEmail(SAMPLES[1]).paragraphs.join(" ")).toContain("Mathematics");
  });

  it("treats messages carrying a token link as sensitive", () => {
    expect(["welcome", "teacher-application", "confirm-email", "password-reset"].every((k) => isSensitiveKind(k))).toBe(true);
    expect(isSensitiveKind("password-changed")).toBe(false);
    expect(isSensitiveKind("teacher-approved")).toBe(false);
  });
});

describe("parseEmailMessage", () => {
  it("reads a stored payload back into a message", () => {
    expect(parseEmailMessage("password-reset", { name: "Ada", resetUrl: URL_ })).toEqual({ kind: "password-reset", data: { name: "Ada", resetUrl: URL_ } });
  });

  it("rejects unknown kinds, missing fields and non-web links", () => {
    expect(parseEmailMessage("nope", { name: "Ada" })).toBeNull();
    expect(parseEmailMessage("password-reset", { name: "Ada" })).toBeNull();
    expect(parseEmailMessage("password-reset", { name: "Ada", resetUrl: "javascript:alert(1)" })).toBeNull();
    expect(parseEmailMessage("password-reset", null)).toBeNull();
  });
});

describe("layout", () => {
  const evil: EmailMessage = { kind: "welcome", data: { name: `<script>alert("x")</script> & co`, confirmUrl: `${URL_}&x="1"` } };

  it("escapes everything that reaches the HTML", () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe("&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;");
    const html = toHtml(renderEmail(evil));
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain(`href="${URL_}&amp;x=&quot;1&quot;"`);
  });

  it("builds a complete HTML document with the preview, button and footer", () => {
    const content = renderEmail(SAMPLES[3]);
    const html = toHtml(content);
    expect(html.startsWith("<!DOCTYPE html>")).toBe(true);
    expect(html).toContain(`<title>${escapeHtml(content.subject)}</title>`);
    expect(html).toContain(escapeHtml(content.preview));
    expect(html).toContain(">Choose a new password</a>");
    expect(html).toContain(SITE.name);
    expect(html).toContain(escapeHtml(SITE.supportEmail));
  });

  it("writes a plain-text version with the link spelled out", () => {
    const text = toText(renderEmail(SAMPLES[3]));
    expect(text).toContain("Hi Ada,");
    expect(text).toContain(`Choose a new password: ${URL_}`);
    expect(text).toContain(SITE.supportEmail);
    expect(text).not.toMatch(/<[a-z]/i);
  });

  it("leaves the button out when a message has no action", () => {
    const content = renderEmail(SAMPLES[7]);
    expect(content.action).toBeUndefined();
    expect(toHtml(content)).not.toContain('<a href="https://www.xcelstudy.com/confirm');
  });
});
