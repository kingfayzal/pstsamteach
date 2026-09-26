import { getCurrentUser } from "@/server/auth/session";
import { getTeacherPhoto } from "@/server/queries/teachers";

const notFound = () => new Response("Not found", { status: 404 });

/** Serves a teacher's photo. Hidden profiles' photos are only visible to the teacher and admins. */
export async function GET(_request: Request, context: RouteContext<"/media/teachers/[profileId]">) {
  const { profileId } = await context.params;
  const photo = await getTeacherPhoto(profileId);
  if (!photo) return notFound();
  if (photo.profile.isHidden) {
    const user = await getCurrentUser();
    if (!user || (user.role !== "ADMIN" && user.id !== photo.profile.userId)) return notFound();
  }
  return new Response(new Uint8Array(photo.data), {
    headers: {
      "Content-Type": photo.contentType,
      "Content-Disposition": "inline",
      "X-Content-Type-Options": "nosniff",
      // URLs carry a version (?v=updatedAt), so public copies can be cached forever.
      "Cache-Control": photo.profile.isHidden ? "private, no-store" : "public, max-age=31536000, immutable",
    },
  });
}
