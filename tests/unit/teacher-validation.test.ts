import { describe, expect, it } from "vitest";
import { formatClock, formatSlot, minutesToClock } from "@/lib/time-zones";
import {
  availabilitySchema,
  bookingSchema,
  connectionRequestSchema,
  messageSchema,
  reviewSchema,
  teacherProfileSchema,
  topicSchema,
} from "@/lib/validation/teacher";
import { fieldErrors } from "@/lib/validation/form";

const validProfile = {
  headline: "Nurse educator who makes dosage calculations click",
  about: "I have taught nursing students for ten years.",
  teachingStyle: "",
  experienceYears: "10",
  qualifications: "",
  videoUrl: "",
  meetingUrl: "https://meet.example.com/ruth",
  timeZone: "Africa/Lagos",
  sessionMinutes: "60",
  acceptingStudents: "on",
  topicIds: ["t1", "t2"],
  languages: ["English", "Yoruba"],
};

describe("teacherProfileSchema", () => {
  it("parses a full profile and normalises blanks", () => {
    const parsed = teacherProfileSchema.parse(validProfile);
    expect(parsed).toMatchObject({
      experienceYears: 10,
      teachingStyle: null,
      videoUrl: null,
      sessionMinutes: 60,
      acceptingStudents: true,
      languages: ["English", "Yoruba"],
    });
  });

  it("treats a missing checkbox as not accepting", () => {
    const { acceptingStudents: _, ...rest } = validProfile;
    expect(teacherProfileSchema.parse(rest).acceptingStudents).toBe(false);
  });

  it("rejects unknown languages, bad zones, odd session lengths and non-https meeting links", () => {
    const result = teacherProfileSchema.safeParse({
      ...validProfile,
      languages: ["Klingon"],
      timeZone: "Mars/Base",
      sessionMinutes: "50",
      meetingUrl: "http://insecure.example.com",
      videoUrl: "https://evil.example.com/video",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(Object.keys(fieldErrors(result.error))).toEqual(
        expect.arrayContaining(["languages", "timeZone", "sessionMinutes", "meetingUrl", "videoUrl"]),
      );
    }
  });

  it("caps topics and languages", () => {
    const many = teacherProfileSchema.safeParse({ ...validProfile, topicIds: Array.from({ length: 13 }, (_, i) => `t${i}`) });
    expect(many.success).toBe(false);
  });
});

describe("availabilitySchema", () => {
  const encode = (windows: unknown) => ({ windows: JSON.stringify(windows) });

  it("accepts half-hour windows", () => {
    const parsed = availabilitySchema.parse(encode([{ weekday: 1, startMinute: 1080, endMinute: 1200 }]));
    expect(parsed.windows).toEqual([{ weekday: 1, startMinute: 1080, endMinute: 1200 }]);
  });

  it("rejects overlaps, reversed times, off-grid minutes and bad JSON", () => {
    expect(
      availabilitySchema.safeParse(
        encode([
          { weekday: 1, startMinute: 1080, endMinute: 1200 },
          { weekday: 1, startMinute: 1140, endMinute: 1260 },
        ]),
      ).success,
    ).toBe(false);
    expect(availabilitySchema.safeParse(encode([{ weekday: 1, startMinute: 1200, endMinute: 1080 }])).success).toBe(false);
    expect(availabilitySchema.safeParse(encode([{ weekday: 1, startMinute: 1085, endMinute: 1200 }])).success).toBe(false);
    expect(availabilitySchema.safeParse(encode([{ weekday: 7, startMinute: 0, endMinute: 60 }])).success).toBe(false);
    expect(availabilitySchema.safeParse({ windows: "not json" }).success).toBe(false);
  });

  it("allows an empty week (a teacher taking a break)", () => {
    expect(availabilitySchema.parse(encode([])).windows).toEqual([]);
  });
});

describe("request, booking, message and review schemas", () => {
  it("needs goals and reads an optional slot", () => {
    const parsed = connectionRequestSchema.parse({ goals: "I want to pass my licensing exam in March.", slotStart: "2026-09-28T17:00:00.000Z", topicId: "" });
    expect(parsed).toMatchObject({ topicId: null, slotStart: new Date("2026-09-28T17:00:00.000Z") });
    expect(connectionRequestSchema.parse({ goals: "I want to pass my licensing exam in March." }).slotStart).toBeNull();
    expect(connectionRequestSchema.safeParse({ goals: "hi" }).success).toBe(false);
    expect(connectionRequestSchema.safeParse({ goals: "x".repeat(30), slotStart: "yesterday" }).success).toBe(false);
  });

  it("requires a slot to book", () => {
    expect(bookingSchema.safeParse({ slotStart: "" }).success).toBe(false);
    expect(bookingSchema.parse({ slotStart: "2026-09-28T17:00:00.000Z", agenda: " Fractions " }).agenda).toBe("Fractions");
  });

  it("validates messages and reviews", () => {
    expect(messageSchema.safeParse({ body: "   " }).success).toBe(false);
    expect(messageSchema.parse({ body: " Hello " }).body).toBe("Hello");
    expect(reviewSchema.parse({ rating: "5", body: "Patient, clear and always prepared." }).rating).toBe(5);
    expect(reviewSchema.safeParse({ rating: "6", body: "Patient, clear and always prepared." }).success).toBe(false);
    expect(reviewSchema.safeParse({ rating: "4", body: "ok" }).success).toBe(false);
  });

  it("validates topic names", () => {
    expect(topicSchema.parse({ name: "  Pharmacology " }).name).toBe("Pharmacology");
    expect(topicSchema.safeParse({ name: "x" }).success).toBe(false);
  });
});

describe("clock formatting", () => {
  it("formats minutes and instants", () => {
    expect(minutesToClock(1080)).toBe("18:00");
    expect(minutesToClock(1440)).toBe("24:00");
    expect(minutesToClock(90)).toBe("01:30");
    expect(formatClock(new Date("2026-09-28T17:00:00Z"), "Africa/Lagos")).toBe("18:00");
    expect(formatSlot(new Date("2026-09-28T17:00:00Z"), "Africa/Lagos")).toBe("Mon 28 Sept, 18:00");
  });
});
