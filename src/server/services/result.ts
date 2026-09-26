import type { z } from "zod";
import type { Role, UserStatus } from "@/generated/prisma/enums";
import { fieldErrors, type FieldErrors } from "@/lib/validation/form";

export type ErrorCode = "INVALID" | "FORBIDDEN" | "NOT_FOUND" | "CONFLICT" | "RATE_LIMITED";

export type ServiceError = { ok: false; code: ErrorCode; message: string; errors?: FieldErrors };
export type ServiceResult<T> = { ok: true; data: T } | ServiceError;

export function ok<T>(data: T): { ok: true; data: T } {
  return { ok: true, data };
}

export function fail(code: ErrorCode, message: string, errors?: FieldErrors): ServiceError {
  return errors ? { ok: false, code, message, errors } : { ok: false, code, message };
}

export function invalid(error: z.ZodError): ServiceError {
  return fail("INVALID", "Check the highlighted fields and try again.", fieldErrors(error));
}

export const forbidden = (message = "You don't have permission to do that.") => fail("FORBIDDEN", message);
export const notFound = (thing = "That item") => fail("NOT_FOUND", `${thing} wasn't found.`);

/** The signed-in user as services see them. */
export type Actor = {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: UserStatus;
};

export function isActive(actor: Actor): boolean {
  return actor.status === "ACTIVE";
}

export function isActiveRole(actor: Actor, role: Role): boolean {
  return actor.role === role && actor.status === "ACTIVE";
}
