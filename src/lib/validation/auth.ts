import { z } from "zod";
import { optionalText } from "./form";

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email("Enter a valid email address.").max(254, "That email address is too long."));

export const newPasswordSchema = z
  .string()
  .min(8, "Use at least 8 characters.")
  .max(128, "Use 128 characters or fewer.")
  .regex(/[A-Za-z]/, "Include at least one letter.")
  .regex(/[0-9]/, "Include at least one number.");

const nameSchema = z.string().trim().min(2, "Enter your full name.").max(80, "Keep your name under 80 characters.");

export const signupSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  password: newPasswordSchema,
});

export const teacherApplicationSchema = signupSchema.extend({
  subjectId: z.string().trim().min(1, "Choose the subject you want to teach.").max(64),
  applicationNote: z
    .string()
    .trim()
    .min(40, "Tell us about your teaching experience in at least 40 characters.")
    .max(2000, "Keep this under 2000 characters."),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your password.").max(128),
});

export const profileSchema = z.object({
  name: nameSchema,
  bio: optionalText(500),
});

export const passwordChangeSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password.").max(128),
    newPassword: newPasswordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    path: ["confirmPassword"],
    error: "The new passwords don't match.",
  });

export type SignupInput = z.infer<typeof signupSchema>;
export type TeacherApplicationInput = z.infer<typeof teacherApplicationSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
