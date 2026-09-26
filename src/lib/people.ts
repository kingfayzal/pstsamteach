import type { Role, UserStatus } from "@/generated/prisma/enums";

export const ROLE_LABEL: Readonly<Record<Role, string>> = {
  STUDENT: "Student",
  TEACHER: "Teacher",
  ADMIN: "Admin",
};

export const USER_STATUS_LABEL: Readonly<Record<UserStatus, string>> = {
  ACTIVE: "Active",
  PENDING: "Awaiting approval",
  SUSPENDED: "Suspended",
};

export const STATUS_TONE: Readonly<Record<UserStatus, "good" | "warn" | "bad">> = {
  ACTIVE: "good",
  PENDING: "warn",
  SUSPENDED: "bad",
};
