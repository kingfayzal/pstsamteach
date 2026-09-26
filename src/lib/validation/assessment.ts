import { z } from "zod";
import { optionalText } from "./form";

export const ASSESSMENT_KINDS = ["QUIZ", "ASSIGNMENT"] as const;

const blankToUndefined = (value: unknown) => (value === "" || value === null ? undefined : value);

export const assessmentSchema = z.object({
  title: z.string().trim().min(2, "Give it a title.").max(120, "Keep the title under 120 characters."),
  instructions: z.string().trim().min(1, "Write instructions for students.").max(5000, "Keep instructions under 5000 characters."),
  kind: z.enum(ASSESSMENT_KINDS, "Choose quiz or assignment."),
  passPercent: z.preprocess(
    blankToUndefined,
    z.coerce.number().int().min(0, "Use 0 to 100.").max(100, "Use 0 to 100.").default(60),
  ),
  maxPoints: z.preprocess(
    blankToUndefined,
    z.coerce.number().int().min(1, "Use at least 1 point.").max(1000, "Use 1000 points or fewer.").default(100),
  ),
  dueAt: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value ? new Date(value) : null))
    .refine((value) => value === null || !Number.isNaN(value.getTime()), "Enter a valid date."),
});

export const MIN_OPTIONS = 2;
export const MAX_OPTIONS = 6;

export const questionSchema = z
  .object({
    prompt: z.string().trim().min(3, "Write the question.").max(500, "Keep the question under 500 characters."),
    explanation: optionalText(1000),
    options: z.array(z.string().max(300, "Keep each option under 300 characters.")).max(MAX_OPTIONS),
    correctIndex: z.coerce.number().int().min(0),
  })
  .transform((data) => {
    const labelled = data.options
      .map((label, index) => ({ label: label.trim(), isCorrect: index === data.correctIndex }))
      .filter((option) => option.label.length > 0);
    return {
      prompt: data.prompt,
      explanation: data.explanation,
      options: labelled.map((option) => option.label),
      correctIndex: labelled.findIndex((option) => option.isCorrect),
    };
  })
  .refine((data) => data.options.length >= MIN_OPTIONS, {
    path: ["options"],
    error: `Add at least ${MIN_OPTIONS} answer options.`,
  })
  .refine((data) => data.correctIndex >= 0, {
    path: ["correctIndex"],
    error: "Mark which option is correct.",
  });

export const gradeSchema = z.object({
  score: z.coerce.number("Enter a score.").int("Use a whole number.").min(0, "Scores can't be negative."),
  feedback: optionalText(5000),
});

export type AssessmentInput = z.infer<typeof assessmentSchema>;
export type QuestionInput = z.infer<typeof questionSchema>;
