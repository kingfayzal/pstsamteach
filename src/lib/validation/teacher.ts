import { z } from "zod";
import { LANGUAGES } from "@/lib/languages";
import { SESSION_LENGTHS, SLOT_STEP_MINUTES } from "@/lib/scheduling";
import { isValidTimeZone } from "@/lib/time-zones";
import { toEmbedUrl } from "@/lib/video";
import { idSchema, optionalText } from "./form";

const blankToUndefined = (value: unknown) => (value === "" || value === null ? undefined : value);

const httpsUrl = z
  .string()
  .trim()
  .max(300, "Keep the link under 300 characters.")
  .optional()
  .transform((value) => (value ? value : null))
  .refine((value) => {
    if (value === null) return true;
    try {
      return new URL(value).protocol === "https:";
    } catch {
      return false;
    }
  }, "Use a full link starting with https://");

export const timeZoneSchema = z.string().refine(isValidTimeZone, "Choose a time zone from the list.");

export const teacherProfileSchema = z.object({
  headline: z.string().trim().max(90, "Keep your headline under 90 characters."),
  about: z.string().trim().max(2000, "Keep this under 2000 characters."),
  teachingStyle: optionalText(1000),
  experienceYears: z.preprocess(
    blankToUndefined,
    z.coerce.number().int("Use whole years.").min(0, "Use 0 or more.").max(60, "Use 60 or fewer.").optional(),
  ).transform((value) => value ?? null),
  qualifications: optionalText(1000),
  videoUrl: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value ? value : null))
    .refine((value) => value === null || toEmbedUrl(value) !== null, "Use a YouTube or Vimeo link."),
  meetingUrl: httpsUrl,
  timeZone: timeZoneSchema,
  sessionMinutes: z.coerce
    .number()
    .refine((n) => (SESSION_LENGTHS as readonly number[]).includes(n), "Choose a session length from the list."),
  acceptingStudents: z
    .string()
    .optional()
    .transform((value) => value === "on" || value === "true"),
  topicIds: z.array(idSchema).max(12, "Choose up to 12 topics.").default([]),
  languages: z.array(z.enum(LANGUAGES, "Choose languages from the list.")).max(8, "Choose up to 8 languages.").default([]),
});

const windowSchema = z
  .object({
    weekday: z.number().int().min(0).max(6),
    startMinute: z.number().int().min(0).max(1440 - SLOT_STEP_MINUTES),
    endMinute: z.number().int().min(SLOT_STEP_MINUTES).max(1440),
  })
  .refine((w) => w.startMinute % SLOT_STEP_MINUTES === 0 && w.endMinute % SLOT_STEP_MINUTES === 0, "Use half-hour steps.")
  .refine((w) => w.startMinute < w.endMinute, "Each time range must end after it starts.");

function hasOverlap(windows: readonly { weekday: number; startMinute: number; endMinute: number }[]): boolean {
  const sorted = [...windows].sort((a, b) => a.weekday - b.weekday || a.startMinute - b.startMinute);
  return sorted.some((w, i) => i > 0 && sorted[i - 1].weekday === w.weekday && sorted[i - 1].endMinute > w.startMinute);
}

export const availabilitySchema = z.object({
  windows: z
    .string()
    .transform((raw, ctx) => {
      try {
        return JSON.parse(raw) as unknown;
      } catch {
        ctx.addIssue({ code: "custom", message: "Your availability couldn't be read. Try again." });
        return z.NEVER;
      }
    })
    .pipe(z.array(windowSchema).max(35, "That's too many time ranges."))
    .refine((windows) => !hasOverlap(windows), "Time ranges on the same day can't overlap."),
});

const isoInstant = z
  .string()
  .trim()
  .refine((value) => !Number.isNaN(Date.parse(value)) && /^\d{4}-\d{2}-\d{2}T/.test(value), "Choose a time from the list.")
  .transform((value) => new Date(value));

export const connectionRequestSchema = z.object({
  topicId: z
    .string()
    .trim()
    .max(64)
    .optional()
    .transform((value) => (value ? value : null)),
  goals: z
    .string()
    .trim()
    .min(20, "Tell the teacher a little about yourself and your goals, in at least 20 characters.")
    .max(1000, "Keep this under 1000 characters."),
  slotStart: z
    .string()
    .optional()
    .transform((value) => (value ? value : undefined))
    .pipe(isoInstant.optional())
    .transform((value) => value ?? null),
  agenda: optionalText(500),
});

export const bookingSchema = z.object({
  slotStart: isoInstant,
  agenda: optionalText(500),
});

export const declineSchema = z.object({ note: optionalText(500) });
export const cancelSchema = z.object({ reason: optionalText(300) });

export const messageSchema = z.object({
  body: z.string().trim().min(1, "Write a message first.").max(2000, "Keep messages under 2000 characters."),
});

export const reviewSchema = z.object({
  rating: z.coerce.number("Choose a rating.").int().min(1, "Choose 1 to 5 stars.").max(5, "Choose 1 to 5 stars."),
  body: z.string().trim().min(20, "Write at least 20 characters.").max(1000, "Keep your review under 1000 characters."),
});

export const topicSchema = z.object({
  name: z.string().trim().min(2, "Name the topic.").max(50, "Keep the name under 50 characters."),
});

export type TeacherProfileInput = z.infer<typeof teacherProfileSchema>;
export type ConnectionRequestInput = z.infer<typeof connectionRequestSchema>;
