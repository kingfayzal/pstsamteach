import { z } from "zod";
import { idSchema } from "./form";

export const COURSE_LEVELS = ["FOUNDATION", "INTERMEDIATE", "ADVANCED"] as const;

export const LEVEL_LABEL: Readonly<Record<(typeof COURSE_LEVELS)[number], string>> = {
  FOUNDATION: "Foundation",
  INTERMEDIATE: "Intermediate",
  ADVANCED: "Advanced",
};

export const courseSchema = z.object({
  title: z.string().trim().min(4, "Give the course a title of at least 4 characters.").max(120, "Keep the title under 120 characters."),
  summary: z
    .string()
    .trim()
    .min(20, "Write a one-line summary of at least 20 characters.")
    .max(200, "Keep the summary under 200 characters."),
  description: z.string().trim().min(1, "Describe what students will learn.").max(5000, "Keep the description under 5000 characters."),
  subjectId: idSchema,
  level: z.enum(COURSE_LEVELS, "Choose a level."),
});

export const announcementSchema = z.object({
  title: z.string().trim().min(3, "Add a title.").max(120, "Keep the title under 120 characters."),
  body: z.string().trim().min(3, "Write the announcement.").max(5000, "Keep it under 5000 characters."),
});

export type CourseInput = z.infer<typeof courseSchema>;
export type AnnouncementInput = z.infer<typeof announcementSchema>;
