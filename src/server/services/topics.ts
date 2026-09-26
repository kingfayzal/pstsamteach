import "server-only";
import { slugify } from "@/lib/slug";
import { topicSchema } from "@/lib/validation/teacher";
import { db } from "@/server/db";
import { recordAudit } from "./audit";
import { type Actor, fail, forbidden, invalid, isActiveRole, notFound, ok, type ServiceResult } from "./result";

const DUPLICATE = "That subject already has a topic with this name.";

export async function createTopic(actor: Actor, subjectId: string, input: unknown): Promise<ServiceResult<{ id: string }>> {
  if (!isActiveRole(actor, "ADMIN")) return forbidden();
  const parsed = topicSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const subject = await db.subject.findUnique({ where: { id: subjectId }, select: { id: true, name: true } });
  if (!subject) return notFound("That subject");
  const slug = slugify(parsed.data.name, "topic");
  const clash = await db.topic.count({ where: { subjectId, OR: [{ slug }, { name: parsed.data.name }] } });
  if (clash > 0) return fail("CONFLICT", DUPLICATE, { name: [DUPLICATE] });
  const last = await db.topic.findFirst({ where: { subjectId }, orderBy: { position: "desc" }, select: { position: true } });
  const topic = await db.$transaction(async (tx) => {
    const created = await tx.topic.create({
      data: { subjectId, name: parsed.data.name, slug, position: (last?.position ?? 0) + 1 },
      select: { id: true },
    });
    await recordAudit(tx, { actorId: actor.id, action: "topic.create", entity: "subject", entityId: subjectId, summary: `Added topic ${parsed.data.name} to ${subject.name}` });
    return created;
  });
  return ok(topic);
}

export async function renameTopic(actor: Actor, topicId: string, input: unknown): Promise<ServiceResult<null>> {
  if (!isActiveRole(actor, "ADMIN")) return forbidden();
  const parsed = topicSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const topic = await db.topic.findUnique({ where: { id: topicId }, select: { id: true, subjectId: true } });
  if (!topic) return notFound("That topic");
  const slug = slugify(parsed.data.name, "topic");
  const clash = await db.topic.count({ where: { subjectId: topic.subjectId, NOT: { id: topicId }, OR: [{ slug }, { name: parsed.data.name }] } });
  if (clash > 0) return fail("CONFLICT", DUPLICATE, { name: [DUPLICATE] });
  await db.topic.update({ where: { id: topicId }, data: { name: parsed.data.name, slug } });
  return ok(null);
}

export async function deleteTopic(actor: Actor, topicId: string): Promise<ServiceResult<null>> {
  if (!isActiveRole(actor, "ADMIN")) return forbidden();
  const topic = await db.topic.findUnique({ where: { id: topicId }, select: { id: true, name: true, subjectId: true } });
  if (!topic) return notFound("That topic");
  await db.$transaction(async (tx) => {
    await tx.topic.delete({ where: { id: topicId } });
    await recordAudit(tx, { actorId: actor.id, action: "topic.delete", entity: "subject", entityId: topic.subjectId, summary: `Removed topic ${topic.name}` });
  });
  return ok(null);
}
