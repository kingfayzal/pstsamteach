import { z } from "zod";
import { toEmbedUrl } from "@/lib/video";

export const lessonSchema = z.object({
  title: z.string().trim().min(2, "Give the lesson a title.").max(120, "Keep the title under 120 characters."),
  body: z.string().trim().min(1, "Write the lesson content.").max(20000, "Keep the lesson under 20,000 characters."),
  durationMinutes: z.coerce
    .number("Enter the time in minutes.")
    .int("Use whole minutes.")
    .min(1, "Use at least 1 minute.")
    .max(600, "Keep lessons under 10 hours."),
  videoUrl: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value ? value : null))
    .refine((value) => value === null || toEmbedUrl(value) !== null, "Use a YouTube or Vimeo link."),
});

export type LessonInput = z.infer<typeof lessonSchema>;
