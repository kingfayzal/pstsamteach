import { z } from "zod";
// Relative, not "@/": next.config.ts loads this file before path aliases exist.
import { SITE } from "../site";

export type EmailConfig = {
  apiKey: string;
  /** "Xcel Study <hello@xcelstudy.com>" or a bare address, on a domain verified in Resend. */
  from: string;
  /** Where replies go. Null means the support address (src/lib/site.ts). */
  replyTo: string | null;
};

type Env = Record<string, string | undefined>;

/** Resend only sends from domains you've verified; these are the usual mistake. */
const FREE_MAIL_DOMAINS = ["gmail.com", "googlemail.com", "yahoo.com", "outlook.com", "hotmail.com", "live.com", "icloud.com", "aol.com"];

const address = z.email();

/** The address inside "Name <address>", or the whole value when it's a bare address. */
function addressOf(value: string): string | null {
  const match = /^[^<>]*<([^<>]+)>$/.exec(value) ?? /^([^<>\s]+)$/.exec(value);
  const candidate = match?.[1]?.trim().toLowerCase();
  return candidate && address.safeParse(candidate).success ? candidate : null;
}

/**
 * Transactional email through Resend (ADR-0002). Off when neither variable is
 * set: emails are then written to the server log instead of sent. A partial or
 * unusable setup throws, so a deploy fails loudly instead of quietly not sending.
 */
export function parseEmailConfig(env: Env): EmailConfig | null {
  const apiKey = env.RESEND_API_KEY?.trim() ?? "";
  const from = env.EMAIL_FROM?.trim() ?? "";
  if (!apiKey && !from) return null;

  const problems: string[] = [];
  if (!apiKey) problems.push("RESEND_API_KEY is missing.");
  // Never echo the key itself into a build log.
  else if (!apiKey.startsWith("re_")) problems.push("RESEND_API_KEY should be a Resend API key (it starts with re_).");

  const fromAddress = from ? addressOf(from) : null;
  if (!from) problems.push("EMAIL_FROM is missing.");
  else if (!fromAddress) problems.push('EMAIL_FROM should look like "Xcel Study <hello@your-domain.com>".');
  else {
    const domain = fromAddress.split("@")[1];
    if (FREE_MAIL_DOMAINS.includes(domain)) {
      problems.push(`EMAIL_FROM can't use ${domain}: send from your own domain, verified in Resend, and put the ${domain} address in EMAIL_REPLY_TO.`);
    }
  }

  const replyTo = env.EMAIL_REPLY_TO?.trim() || null;
  if (replyTo && !address.safeParse(replyTo).success) problems.push("EMAIL_REPLY_TO should be a single email address.");

  if (problems.length > 0) throw new Error(`Email is misconfigured: ${problems.join(" ")}`);
  return { apiKey, from, replyTo };
}

/**
 * Production must be able to send: without it nobody can confirm an email
 * address or reset a password. Previews and local builds may go without.
 */
export function assertEmailReadyForDeploy(env: Env): void {
  const config = parseEmailConfig(env);
  if (!config && env.VERCEL_ENV === "production") {
    throw new Error("Email is misconfigured: production deploys need RESEND_API_KEY and EMAIL_FROM (see README, Email).");
  }
}

/**
 * The address links in emails point at. Never taken from the request's Host
 * header, which a client controls (that would let someone send a victim a
 * reset link to their own site).
 */
export function appOrigin(env: Env): string {
  if (env.APP_URL) {
    const url = URL.canParse(env.APP_URL) ? new URL(env.APP_URL) : null;
    if (!url || (url.protocol !== "https:" && url.protocol !== "http:")) throw new Error("APP_URL should be the site's address, like https://www.xcelstudy.com.");
    return url.origin;
  }
  if (env.VERCEL_ENV === "production") return env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${env.VERCEL_PROJECT_PRODUCTION_URL}` : SITE.url;
  const host = env.VERCEL_BRANCH_URL || env.VERCEL_URL;
  if (env.VERCEL_ENV === "preview" && host) return `https://${host}`;
  return "http://localhost:3000";
}
