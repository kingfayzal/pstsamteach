import { describe, expect, it } from "vitest";
import { loginSchema, signupSchema, teacherApplicationSchema } from "@/lib/validation/auth";
import { courseSchema } from "@/lib/validation/course";
import { lessonSchema } from "@/lib/validation/lesson";
import { assessmentSchema, questionSchema } from "@/lib/validation/assessment";
import { subjectSchema } from "@/lib/validation/admin";
import { fieldErrors, formDataToObject } from "@/lib/validation/form";

describe("signupSchema", () => {
  it("normalises email and trims the name", () => {
    const parsed = signupSchema.parse({ name: "  Ada Obi ", email: " Ada@Example.COM ", password: "learning123" });
    expect(parsed).toEqual({ name: "Ada Obi", email: "ada@example.com", password: "learning123" });
  });

  it("requires a password with letters and numbers", () => {
    const result = signupSchema.safeParse({ name: "Ada", email: "ada@example.com", password: "onlyletters" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(fieldErrors(result.error).password?.[0]).toMatch(/number/);
    }
  });

  it("rejects very long passwords (scrypt DoS guard)", () => {
    const result = signupSchema.safeParse({ name: "Ada", email: "ada@example.com", password: "a1".repeat(80) });
    expect(result.success).toBe(false);
  });
});

describe("teacherApplicationSchema", () => {
  it("needs a subject and a note about experience", () => {
    const result = teacherApplicationSchema.safeParse({
      name: "Tunde",
      email: "t@example.com",
      password: "teaching123",
      subjectId: "",
      applicationNote: "hi",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = fieldErrors(result.error);
      expect(errors.subjectId).toBeDefined();
      expect(errors.applicationNote).toBeDefined();
    }
  });
});

describe("loginSchema", () => {
  it("accepts any non-empty password (policy applies at signup)", () => {
    expect(loginSchema.safeParse({ email: "a@b.co", password: "x" }).success).toBe(true);
  });
});

describe("courseSchema", () => {
  it("parses a valid course", () => {
    const parsed = courseSchema.parse({
      title: "Algebra from the ground up",
      summary: "Solve linear equations with confidence.",
      description: "d".repeat(40),
      subjectId: "sub_1",
      level: "FOUNDATION",
    });
    expect(parsed.level).toBe("FOUNDATION");
  });

  it("rejects an unknown level", () => {
    expect(
      courseSchema.safeParse({ title: "Algebra", summary: "s".repeat(20), description: "d", subjectId: "x", level: "EXPERT" })
        .success,
    ).toBe(false);
  });
});

describe("lessonSchema", () => {
  it("coerces duration and treats an empty video URL as none", () => {
    const parsed = lessonSchema.parse({ title: "Commas", body: "Body text here.", durationMinutes: "12", videoUrl: "" });
    expect(parsed).toMatchObject({ durationMinutes: 12, videoUrl: null });
  });

  it("rejects video links from unsupported hosts", () => {
    const result = lessonSchema.safeParse({
      title: "Commas",
      body: "Body text here.",
      durationMinutes: "12",
      videoUrl: "https://example.com/v.mp4",
    });
    expect(result.success).toBe(false);
  });
});

describe("assessmentSchema", () => {
  it("coerces numbers and optional due date", () => {
    const parsed = assessmentSchema.parse({
      title: "Quiz 1",
      instructions: "Answer all questions.",
      kind: "QUIZ",
      passPercent: "70",
      maxPoints: "",
      dueAt: "",
    });
    expect(parsed).toMatchObject({ passPercent: 70, maxPoints: 100, dueAt: null });
  });
});

describe("questionSchema", () => {
  it("requires exactly one correct option among 2 to 6", () => {
    const ok = questionSchema.safeParse({
      prompt: "2 + 2 = ?",
      options: ["3", "4", "", ""],
      correctIndex: "1",
    });
    expect(ok.success).toBe(true);
    if (ok.success) expect(ok.data.options).toEqual(["3", "4"]);

    const outOfRange = questionSchema.safeParse({ prompt: "2 + 2 = ?", options: ["3", "4"], correctIndex: "3" });
    expect(outOfRange.success).toBe(false);

    const tooFew = questionSchema.safeParse({ prompt: "2 + 2 = ?", options: ["4", ""], correctIndex: "0" });
    expect(tooFew.success).toBe(false);
  });
});

describe("subjectSchema", () => {
  it("accepts a hex colour only", () => {
    const base = { name: "Biology", tagline: "Cells to systems", description: "Life science courses." };
    expect(subjectSchema.safeParse({ ...base, color: "#0A7684" }).success).toBe(true);
    expect(subjectSchema.safeParse({ ...base, color: "red; background:url(x)" }).success).toBe(false);
  });
});

describe("formDataToObject", () => {
  it("collects repeated keys into arrays", () => {
    const form = new FormData();
    form.append("title", "T");
    form.append("options", "a");
    form.append("options", "b");
    expect(formDataToObject(form, ["options"])).toEqual({ title: "T", options: ["a", "b"] });
  });

  it("drops Next.js internal action fields", () => {
    const form = new FormData();
    form.append("$ACTION_ID_123", "");
    form.append("name", "x");
    expect(formDataToObject(form)).toEqual({ name: "x" });
  });
});
