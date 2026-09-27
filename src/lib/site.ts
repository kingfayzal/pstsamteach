/**
 * Brand and platform copy in one place. Set SITE_NAME and SUPPORT_EMAIL in the
 * environment (e.g. Vercel project settings) once the name is decided; the
 * defaults are working placeholders taken from the repository name.
 */
export const SITE = {
  name: process.env.SITE_NAME || "SamTeach",
  tagline: "Learn it. Practise it. Get it marked.",
  description:
    "Courses in English, Mathematics and Nursing, taught by real teachers who read your work and mark it.",
  supportEmail: process.env.SUPPORT_EMAIL || "support@example.com",
} as const;
