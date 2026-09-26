import type { Role } from "@/generated/prisma/enums";

export type NavEntry = { href: string; label: string; exact?: boolean; count?: number };

export const AREA_LABEL: Readonly<Record<Role, string>> = {
  STUDENT: "Student",
  TEACHER: "Teacher",
  ADMIN: "Platform admin",
};

export const STUDENT_NAV: readonly NavEntry[] = [
  { href: "/learn", label: "Dashboard", exact: true },
  { href: "/learn/courses", label: "My courses" },
  { href: "/learn/teachers", label: "My teachers" },
  { href: "/learn/grades", label: "Grades" },
  { href: "/teachers", label: "Find a teacher" },
  { href: "/courses", label: "Find a course" },
];

export const TEACHER_NAV: readonly NavEntry[] = [
  { href: "/teach", label: "Dashboard", exact: true },
  { href: "/teach/students", label: "Students" },
  { href: "/teach/courses", label: "Courses" },
  { href: "/teach/marking", label: "Marking" },
  { href: "/teach/profile", label: "Your profile" },
];

export const PENDING_TEACHER_NAV: readonly NavEntry[] = [
  { href: "/teach/pending", label: "Your application" },
  { href: "/teach/profile", label: "Your profile" },
];

export const ADMIN_NAV: readonly NavEntry[] = [
  { href: "/admin", label: "Overview", exact: true },
  { href: "/admin/review", label: "Review queue" },
  { href: "/admin/courses", label: "Courses" },
  { href: "/admin/teachers", label: "Teachers" },
  { href: "/admin/people", label: "People" },
  { href: "/admin/subjects", label: "Subjects" },
  { href: "/admin/announcements", label: "Announcements" },
  { href: "/admin/activity", label: "Activity log" },
];

const BY_ROLE: Readonly<Record<Role, readonly NavEntry[]>> = { STUDENT: STUDENT_NAV, TEACHER: TEACHER_NAV, ADMIN: ADMIN_NAV };

/** A role's navigation, with optional badge counts keyed by href. */
export function navFor(role: Role, counts: Readonly<Record<string, number>> = {}): NavEntry[] {
  return BY_ROLE[role].map((entry) => (counts[entry.href] ? { ...entry, count: counts[entry.href] } : entry));
}
