import "server-only";
import type { Role } from "@/generated/prisma/enums";
import { slugify } from "@/lib/slug";
import { subjectSchema } from "@/lib/validation/admin";
import { revokeUserSessions } from "@/server/auth/session-store";
import { db } from "@/server/db";
import { getVideoProvider, type VideoProvider } from "@/server/video";
import { recordAudit } from "./audit";
import { closeLiveRooms } from "./live-sessions";
import { type Actor, fail, forbidden, invalid, isActiveRole, notFound, ok, type ServiceResult } from "./result";

const ROLES: readonly Role[] = ["STUDENT", "TEACHER", "ADMIN"];

async function loadOtherUser(actor: Actor, userId: string) {
  if (!isActiveRole(actor, "ADMIN")) return forbidden();
  if (actor.id === userId) return fail("CONFLICT", "You can't change your own account from here.");
  const user = await db.user.findUnique({ where: { id: userId }, select: { id: true, name: true, role: true, status: true } });
  if (!user) return notFound("That person");
  return ok(user);
}

export async function approveTeacher(actor: Actor, userId: string): Promise<ServiceResult<null>> {
  const loaded = await loadOtherUser(actor, userId);
  if (!loaded.ok) return loaded;
  const user = loaded.data;
  if (user.role !== "TEACHER" || user.status !== "PENDING") return fail("CONFLICT", "This person has no pending teacher application.");
  await db.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { status: "ACTIVE" } });
    await recordAudit(tx, { actorId: actor.id, action: "user.approve", entity: "user", entityId: userId, summary: `Approved teacher: ${user.name}` });
  });
  return ok(null);
}

/** Declined applicants keep their account as students, so they can still learn. */
export async function declineTeacher(actor: Actor, userId: string): Promise<ServiceResult<null>> {
  const loaded = await loadOtherUser(actor, userId);
  if (!loaded.ok) return loaded;
  const user = loaded.data;
  if (user.role !== "TEACHER" || user.status !== "PENDING") return fail("CONFLICT", "This person has no pending teacher application.");
  await db.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { role: "STUDENT", status: "ACTIVE" } });
    await recordAudit(tx, {
      actorId: actor.id,
      action: "user.decline",
      entity: "user",
      entityId: userId,
      summary: `Declined teacher application: ${user.name} (kept as student)`,
    });
  });
  return ok(null);
}

export async function suspendUser(
  actor: Actor,
  userId: string,
  now = new Date(),
  provider: VideoProvider | null = getVideoProvider(),
): Promise<ServiceResult<null>> {
  const loaded = await loadOtherUser(actor, userId);
  if (!loaded.ok) return loaded;
  if (loaded.data.status === "SUSPENDED") return ok(null);
  await db.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { status: "SUSPENDED" } });
    await recordAudit(tx, { actorId: actor.id, action: "user.suspend", entity: "user", entityId: userId, summary: `Suspended: ${loaded.data.name}` });
  });
  await revokeUserSessions(userId);
  // Signing out isn't enough for a call already under way: close their open video rooms too.
  await closeLiveRooms({ userId }, now, provider);
  return ok(null);
}

export async function reactivateUser(actor: Actor, userId: string): Promise<ServiceResult<null>> {
  const loaded = await loadOtherUser(actor, userId);
  if (!loaded.ok) return loaded;
  if (loaded.data.status !== "SUSPENDED") return fail("CONFLICT", "This account isn't suspended.");
  await db.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { status: "ACTIVE" } });
    await recordAudit(tx, { actorId: actor.id, action: "user.reactivate", entity: "user", entityId: userId, summary: `Reactivated: ${loaded.data.name}` });
  });
  return ok(null);
}

export async function changeUserRole(actor: Actor, userId: string, role: unknown): Promise<ServiceResult<null>> {
  const loaded = await loadOtherUser(actor, userId);
  if (!loaded.ok) return loaded;
  if (typeof role !== "string" || !ROLES.includes(role as Role)) return fail("INVALID", "Choose a valid role.");
  const nextRole = role as Role;
  const user = loaded.data;
  if (user.role === nextRole) return ok(null);
  if (user.role === "TEACHER" && (await db.course.count({ where: { teacherId: userId } })) > 0) {
    return fail("CONFLICT", "This teacher still owns courses. Archive or reassign them first.");
  }
  await db.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: { role: nextRole, status: user.status === "PENDING" ? "ACTIVE" : user.status },
    });
    await recordAudit(tx, {
      actorId: actor.id,
      action: "user.role",
      entity: "user",
      entityId: userId,
      summary: `Changed role for ${user.name}: ${user.role.toLowerCase()} to ${nextRole.toLowerCase()}`,
    });
  });
  await revokeUserSessions(userId);
  return ok(null);
}

export async function createSubject(actor: Actor, input: unknown): Promise<ServiceResult<{ id: string }>> {
  if (!isActiveRole(actor, "ADMIN")) return forbidden();
  const parsed = subjectSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const slug = slugify(parsed.data.name, "subject");
  const clash = await db.subject.count({ where: { OR: [{ slug }, { name: parsed.data.name }] } });
  if (clash > 0) return fail("CONFLICT", "A subject with that name already exists.", { name: ["A subject with that name already exists."] });
  const last = await db.subject.findFirst({ orderBy: { position: "desc" }, select: { position: true } });
  const subject = await db.$transaction(async (tx) => {
    const created = await tx.subject.create({
      data: { ...parsed.data, color: parsed.data.color.toUpperCase(), slug, position: (last?.position ?? 0) + 1 },
      select: { id: true },
    });
    await recordAudit(tx, { actorId: actor.id, action: "subject.create", entity: "subject", entityId: created.id, summary: `Added subject: ${parsed.data.name}` });
    return created;
  });
  return ok(subject);
}

export async function updateSubject(actor: Actor, subjectId: string, input: unknown): Promise<ServiceResult<null>> {
  if (!isActiveRole(actor, "ADMIN")) return forbidden();
  const parsed = subjectSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const subject = await db.subject.findUnique({ where: { id: subjectId }, select: { id: true } });
  if (!subject) return notFound("That subject");
  const clash = await db.subject.count({ where: { name: parsed.data.name, NOT: { id: subjectId } } });
  if (clash > 0) return fail("CONFLICT", "A subject with that name already exists.", { name: ["A subject with that name already exists."] });
  await db.subject.update({ where: { id: subjectId }, data: { ...parsed.data, color: parsed.data.color.toUpperCase() } });
  return ok(null);
}

export async function setSubjectActive(actor: Actor, subjectId: string, isActive: boolean): Promise<ServiceResult<null>> {
  if (!isActiveRole(actor, "ADMIN")) return forbidden();
  const subject = await db.subject.findUnique({ where: { id: subjectId }, select: { id: true, name: true } });
  if (!subject) return notFound("That subject");
  await db.$transaction(async (tx) => {
    await tx.subject.update({ where: { id: subjectId }, data: { isActive } });
    await recordAudit(tx, {
      actorId: actor.id,
      action: isActive ? "subject.activate" : "subject.deactivate",
      entity: "subject",
      entityId: subjectId,
      summary: `${isActive ? "Opened" : "Closed"} subject: ${subject.name}`,
    });
  });
  return ok(null);
}
