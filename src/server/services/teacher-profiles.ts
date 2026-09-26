import "server-only";
import { detectImageType, MAX_PHOTO_BYTES } from "@/lib/images";
import { randomSuffix, slugify, withSuffix } from "@/lib/slug";
import { resolveTimeZone } from "@/lib/time-zones";
import { availabilitySchema, teacherProfileSchema } from "@/lib/validation/teacher";
import { db } from "@/server/db";
import { recordAudit } from "./audit";
import { type Actor, fail, forbidden, invalid, isActiveRole, notFound, ok, type ServiceResult } from "./result";

/** Approved and pending teachers can both work on their profile; only approved ones are listed. */
function canEditProfile(actor: Actor): boolean {
  return actor.role === "TEACHER" && (actor.status === "ACTIVE" || actor.status === "PENDING");
}

async function uniqueProfileSlug(name: string): Promise<string> {
  const base = slugify(name, "teacher");
  let candidate = base;
  for (let attempt = 0; attempt < 6; attempt++) {
    if ((await db.teacherProfile.count({ where: { slug: candidate } })) === 0) return candidate;
    candidate = withSuffix(base, randomSuffix());
  }
  return withSuffix(base, Date.now().toString(36));
}

/** The teacher's profile, created on first use. */
export async function ensureTeacherProfile(actor: Actor): Promise<ServiceResult<{ id: string; slug: string }>> {
  if (!canEditProfile(actor)) return forbidden("Only teachers have a directory profile.");
  const existing = await db.teacherProfile.findUnique({ where: { userId: actor.id }, select: { id: true, slug: true } });
  if (existing) return ok(existing);
  const user = await db.user.findUniqueOrThrow({ where: { id: actor.id }, select: { timeZone: true } });
  const created = await db.teacherProfile.create({
    data: { userId: actor.id, slug: await uniqueProfileSlug(actor.name), timeZone: resolveTimeZone(user.timeZone) },
    select: { id: true, slug: true },
  });
  return ok(created);
}

export async function updateTeacherProfile(actor: Actor, input: unknown): Promise<ServiceResult<null>> {
  const profile = await ensureTeacherProfile(actor);
  if (!profile.ok) return profile;
  const parsed = teacherProfileSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { topicIds, languages, ...fields } = parsed.data;

  const uniqueTopics = [...new Set(topicIds)];
  const validTopics = await db.topic.count({ where: { id: { in: uniqueTopics }, subject: { isActive: true } } });
  if (validTopics !== uniqueTopics.length) {
    const message = "Choose topics from the list.";
    return fail("INVALID", message, { topicIds: [message] });
  }

  await db.$transaction(async (tx) => {
    await tx.teacherProfile.update({ where: { id: profile.data.id }, data: fields });
    await tx.teacherTopic.deleteMany({ where: { profileId: profile.data.id } });
    await tx.teacherTopic.createMany({ data: uniqueTopics.map((topicId) => ({ profileId: profile.data.id, topicId })) });
    await tx.teacherLanguage.deleteMany({ where: { profileId: profile.data.id } });
    await tx.teacherLanguage.createMany({ data: [...new Set(languages)].map((language) => ({ profileId: profile.data.id, language })) });
  });
  return ok(null);
}

export async function setTeacherAvailability(actor: Actor, input: unknown): Promise<ServiceResult<{ windows: number }>> {
  const profile = await ensureTeacherProfile(actor);
  if (!profile.ok) return profile;
  const parsed = availabilitySchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  await db.$transaction([
    db.availabilityWindow.deleteMany({ where: { profileId: profile.data.id } }),
    db.availabilityWindow.createMany({ data: parsed.data.windows.map((w) => ({ ...w, profileId: profile.data.id })) }),
  ]);
  return ok({ windows: parsed.data.windows.length });
}

export async function uploadTeacherPhoto(actor: Actor, bytes: Uint8Array | null): Promise<ServiceResult<null>> {
  const profile = await ensureTeacherProfile(actor);
  if (!profile.ok) return profile;
  if (!bytes || bytes.length === 0) return fail("INVALID", "Choose a photo to upload.", { photo: ["Choose a photo to upload."] });
  if (bytes.length > MAX_PHOTO_BYTES) {
    const message = "That photo is over 2 MB. Choose a smaller one.";
    return fail("INVALID", message, { photo: [message] });
  }
  const contentType = detectImageType(bytes);
  if (!contentType) {
    const message = "Use a JPEG, PNG or WebP photo.";
    return fail("INVALID", message, { photo: [message] });
  }
  const data = new Uint8Array(bytes);
  await db.profilePhoto.upsert({
    where: { profileId: profile.data.id },
    create: { profileId: profile.data.id, data, contentType },
    update: { data, contentType },
  });
  return ok(null);
}

export async function removeTeacherPhoto(actor: Actor): Promise<ServiceResult<null>> {
  const profile = await ensureTeacherProfile(actor);
  if (!profile.ok) return profile;
  await db.profilePhoto.deleteMany({ where: { profileId: profile.data.id } });
  return ok(null);
}

export async function setProfileHidden(actor: Actor, profileId: string, hidden: boolean): Promise<ServiceResult<null>> {
  if (!isActiveRole(actor, "ADMIN")) return forbidden();
  const profile = await db.teacherProfile.findUnique({ where: { id: profileId }, select: { id: true, user: { select: { name: true } } } });
  if (!profile) return notFound("That profile");
  await db.$transaction(async (tx) => {
    await tx.teacherProfile.update({ where: { id: profileId }, data: { isHidden: hidden } });
    await recordAudit(tx, {
      actorId: actor.id,
      action: hidden ? "profile.hide" : "profile.unhide",
      entity: "user",
      entityId: profileId,
      summary: `${hidden ? "Hid" : "Restored"} teacher profile: ${profile.user.name}`,
    });
  });
  return ok(null);
}
