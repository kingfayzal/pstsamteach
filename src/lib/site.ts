/**
 * Brand and platform copy in one place. The name is fixed: an old SITE_NAME
 * left in a deployment's settings must not rename the site. The contact
 * details default to Xcel Study's public ones; SUPPORT_EMAIL and SUPPORT_PHONE
 * in the environment (e.g. Vercel project settings) override them.
 *
 * `url` is the production origin. Link previews load the share image from it,
 * so it must not depend on the host (off Vercel, Next.js would fall back to
 * localhost and previews could pick a teacher's photo from the page instead).
 */
export const SITE = {
  name: "Xcel Study",
  url: "https://www.xcelstudy.com",
  tagline: "Learning with ease",
  description:
    "One-to-one lessons and courses with qualified teachers you choose yourself, at times that suit your schedule.",
  supportEmail: process.env.SUPPORT_EMAIL || "xcelstudy5@gmail.com",
  supportPhone: process.env.SUPPORT_PHONE || "+1 (240) 302-9182",
} as const;

/** A phone number as a tel: link, e.g. "+1 (240) 302-9182" becomes "tel:+12403029182". */
export function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}
