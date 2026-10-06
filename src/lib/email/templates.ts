import { z } from "zod";
import { SITE } from "@/lib/site";

/**
 * Every email Xcel Study sends, as data. Templates only decide the words; one
 * layout (layout.ts) turns them into HTML and plain text, so every email looks
 * the same and nothing written here can break the markup.
 */

export const CONFIRM_LINK_DAYS = 3;
export const RESET_LINK_MINUTES = 60;

const name = z.string().trim().min(1).max(120);
const link = z.url({ protocol: /^https?$/ });

const SCHEMAS = {
  welcome: z.object({ name, confirmUrl: link }),
  "teacher-application": z.object({ name, confirmUrl: link, subjectName: z.string().trim().min(1).max(120) }),
  "confirm-email": z.object({ name, confirmUrl: link }),
  "password-reset": z.object({ name, resetUrl: link }),
  "password-changed": z.object({ name, resetUrl: link }),
  "teacher-approved": z.object({ name, profileUrl: link }),
  "teacher-declined": z.object({ name, learnUrl: link }),
  "account-suspended": z.object({ name }),
  "account-reactivated": z.object({ name, loginUrl: link }),
} as const;

type Schemas = typeof SCHEMAS;
export type EmailKind = keyof Schemas;
export type EmailMessage = { [K in EmailKind]: { kind: K; data: z.infer<Schemas[K]> } }[EmailKind];

export const EMAIL_KINDS = Object.keys(SCHEMAS) as EmailKind[];

/** Kinds whose link signs someone in or proves they own the inbox. Their stored copy is emptied once sent. */
const SENSITIVE: ReadonlySet<string> = new Set<EmailKind>(["welcome", "teacher-application", "confirm-email", "password-reset"]);

export function isSensitiveKind(kind: string): boolean {
  return SENSITIVE.has(kind);
}

/** Read a stored payload back, or null if it no longer matches its template. */
export function parseEmailMessage(kind: string, payload: unknown): EmailMessage | null {
  if (!Object.hasOwn(SCHEMAS, kind)) return null;
  const parsed = SCHEMAS[kind as EmailKind].safeParse(payload);
  return parsed.success ? ({ kind, data: parsed.data } as EmailMessage) : null;
}

export type EmailContent = {
  subject: string;
  /** The line inbox lists show after the subject. */
  preview: string;
  greeting: string;
  paragraphs: string[];
  action?: { label: string; url: string };
  /** Quieter text after the button: how long the link lasts, what to do if it wasn't you. */
  smallPrint: string[];
  footer: string;
};

const firstName = (full: string) => full.trim().split(/\s+/)[0];

const ACCOUNT_FOOTER = `You're getting this because you have an account on ${SITE.name}. Questions? Write to ${SITE.supportEmail}.`;
const SIGNUP_FOOTER = `You're getting this because this address was used to create an account on ${SITE.name}. Questions? Write to ${SITE.supportEmail}.`;
const CONFIRM_SMALL_PRINT = `The link works for ${CONFIRM_LINK_DAYS} days. If you didn't create an account, ignore this email and nothing will happen.`;

export function renderEmail(message: EmailMessage): EmailContent {
  const greeting = `Hi ${firstName(message.data.name)},`;
  switch (message.kind) {
    case "welcome":
      return {
        subject: `Confirm your email for ${SITE.name}`,
        preview: "One click and you can choose a teacher and book sessions.",
        greeting,
        paragraphs: [
          `Welcome to ${SITE.name}. Please confirm this is your email address.`,
          "Once it's confirmed you can choose a teacher, book sessions and send messages, and we can reach you about your sessions.",
        ],
        action: { label: "Confirm my email", url: message.data.confirmUrl },
        smallPrint: [CONFIRM_SMALL_PRINT],
        footer: SIGNUP_FOOTER,
      };
    case "teacher-application":
      return {
        subject: `We've received your application to teach on ${SITE.name}`,
        preview: "Confirm your email while our team reads your application.",
        greeting,
        paragraphs: [
          `Thanks for applying to teach ${message.data.subjectName} on ${SITE.name}. Our team reads every application, and we'll email you as soon as there's a decision.`,
          "In the meantime, please confirm this is your email address so that message reaches you.",
        ],
        action: { label: "Confirm my email", url: message.data.confirmUrl },
        smallPrint: [CONFIRM_SMALL_PRINT],
        footer: SIGNUP_FOOTER,
      };
    case "confirm-email":
      return {
        subject: `Confirm your email for ${SITE.name}`,
        preview: "Here's the new link you asked for.",
        greeting,
        paragraphs: [
          "Here's a new link to confirm your email address.",
          "Once it's confirmed you can choose a teacher, book sessions and send messages.",
        ],
        action: { label: "Confirm my email", url: message.data.confirmUrl },
        smallPrint: [`The link works for ${CONFIRM_LINK_DAYS} days. If you didn't ask for it, you can ignore this email.`],
        footer: ACCOUNT_FOOTER,
      };
    case "password-reset":
      return {
        subject: `Reset your ${SITE.name} password`,
        preview: "The link works for one hour.",
        greeting,
        paragraphs: [`Someone asked to reset the password for your ${SITE.name} account. If it was you, choose a new password below.`],
        action: { label: "Choose a new password", url: message.data.resetUrl },
        smallPrint: [
          "The link works for one hour, and only once.",
          "If you didn't ask for this, ignore this email. Your password stays as it is.",
        ],
        footer: ACCOUNT_FOOTER,
      };
    case "password-changed":
      return {
        subject: `Your ${SITE.name} password was changed`,
        preview: "If this was you, there's nothing else to do.",
        greeting,
        paragraphs: [
          `The password for your ${SITE.name} account was just changed, and your other devices were signed out.`,
          `If this was you, there's nothing else to do. If it wasn't, reset your password now and let us know at ${SITE.supportEmail}.`,
        ],
        action: { label: "Reset my password", url: message.data.resetUrl },
        smallPrint: [],
        footer: ACCOUNT_FOOTER,
      };
    case "teacher-approved":
      return {
        subject: `You're approved to teach on ${SITE.name}`,
        preview: "Set up your teacher profile so students can find you.",
        greeting,
        paragraphs: [
          `Your application to teach on ${SITE.name} has been approved. Welcome aboard.`,
          "Next, fill in your teacher profile: a headline, a few lines about you, your topics, your languages and the times you're free. Students can find you in the teacher directory once it's complete.",
        ],
        action: { label: "Set up my profile", url: message.data.profileUrl },
        smallPrint: [],
        footer: ACCOUNT_FOOTER,
      };
    case "teacher-declined":
      return {
        subject: `About your application to teach on ${SITE.name}`,
        preview: "Your account still works as a student account.",
        greeting,
        paragraphs: [
          `Thank you for applying to teach on ${SITE.name}. Our team has read your application and decided not to approve it at this time.`,
          `Your account now works as a student account, so you can still take courses and learn with our teachers. If you'd like to know more about the decision, write to ${SITE.supportEmail}.`,
        ],
        action: { label: "Go to my account", url: message.data.learnUrl },
        smallPrint: [],
        footer: ACCOUNT_FOOTER,
      };
    case "account-suspended":
      return {
        subject: `Your ${SITE.name} account has been suspended`,
        preview: "Write to us if you'd like access restored.",
        greeting,
        paragraphs: [
          `Your ${SITE.name} account has been suspended, so you can't sign in for now.`,
          `If you think this is a mistake, or you'd like access restored, write to us at ${SITE.supportEmail}.`,
        ],
        smallPrint: [],
        footer: ACCOUNT_FOOTER,
      };
    case "account-reactivated":
      return {
        subject: `Your ${SITE.name} account is active again`,
        preview: "You can sign in again with your email and password.",
        greeting,
        paragraphs: [`Your ${SITE.name} account has been restored. You can sign in again with your email and password.`],
        action: { label: "Log in", url: message.data.loginUrl },
        smallPrint: [],
        footer: ACCOUNT_FOOTER,
      };
  }
}
