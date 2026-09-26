import { z } from "zod";

export const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;

export const subjectSchema = z.object({
  name: z.string().trim().min(2, "Name the subject.").max(40, "Keep the name under 40 characters."),
  tagline: z.string().trim().min(3, "Add a short tagline.").max(80, "Keep the tagline under 80 characters."),
  description: z.string().trim().min(10, "Describe the subject in a sentence or two.").max(500, "Keep it under 500 characters."),
  color: z.string().trim().regex(HEX_COLOR, "Use a hex colour like #2356C2."),
});

export const reviewNoteSchema = z.object({
  note: z
    .string()
    .trim()
    .min(10, "Tell the teacher what to change, in at least 10 characters.")
    .max(1000, "Keep the note under 1000 characters."),
});

export const AUDIENCES = ["EVERYONE", "STUDENTS", "TEACHERS"] as const;

export const platformAnnouncementSchema = z.object({
  title: z.string().trim().min(3, "Add a title.").max(120, "Keep the title under 120 characters."),
  body: z.string().trim().min(3, "Write the announcement.").max(5000, "Keep it under 5000 characters."),
  audience: z.enum(AUDIENCES, "Choose who should see this."),
});

export type SubjectInput = z.infer<typeof subjectSchema>;
export type PlatformAnnouncementInput = z.infer<typeof platformAnnouncementSchema>;
