"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { safeNextPath } from "@/lib/routes";
import { formDataToObject, type FormState } from "@/lib/validation/form";
import { messageLimiter } from "@/server/auth/rate-limit";
import { requireRole, requireUser } from "@/server/auth/session";
import { endConnection, respondToRequest } from "@/server/services/connections";
import { markThreadRead, sendMessage } from "@/server/services/teacher-social";
import { bookSession, cancelSession } from "@/server/services/tutoring";
import { errorState } from "./helpers";

const RETURN_PREFIXES = ["/learn/teachers/", "/teach/students/"];

/** Only allow redirects back to a relationship page. */
function returnPath(value: string): string {
  const path = safeNextPath(value);
  return path && RETURN_PREFIXES.some((p) => path.startsWith(p)) ? path : "/";
}

function refreshTutoring() {
  revalidatePath("/learn", "layout");
  revalidatePath("/teach", "layout");
}

export async function respondToRequestAction(connectionId: string, accept: boolean, _prev: FormState, form: FormData): Promise<FormState> {
  const user = await requireRole("TEACHER");
  const result = await respondToRequest(user, connectionId, accept, formDataToObject(form));
  if (!result.ok) return errorState(result, form);
  refreshTutoring();
  redirect(`/teach/students/${connectionId}?notice=${accept ? "request-accepted" : "request-declined"}`);
}

export async function endConnectionAction(connectionId: string, _prev: FormState): Promise<FormState> {
  const user = await requireUser();
  const result = await endConnection(user, connectionId);
  if (!result.ok) return errorState(result);
  refreshTutoring();
  redirect(user.role === "TEACHER" ? "/teach/students?notice=connection-ended" : "/learn/teachers?notice=connection-ended");
}

export async function bookSessionAction(connectionId: string, _prev: FormState, form: FormData): Promise<FormState> {
  const user = await requireRole("STUDENT");
  const result = await bookSession(user, connectionId, formDataToObject(form));
  if (!result.ok) return errorState(result, form);
  refreshTutoring();
  redirect(`/learn/teachers/${connectionId}?notice=session-booked`);
}

export async function cancelSessionAction(sessionId: string, returnTo: string, _prev: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const result = await cancelSession(user, sessionId, formDataToObject(form));
  if (!result.ok) return errorState(result, form);
  refreshTutoring();
  redirect(`${returnPath(returnTo)}?notice=session-cancelled`);
}

export async function sendMessageAction(connectionId: string, returnTo: string, _prev: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const limit = messageLimiter.hit(`message:${user.id}`);
  if (!limit.allowed) return { ok: false, message: "You're sending messages very quickly. Wait a few minutes and try again." };
  const result = await sendMessage(user, connectionId, formDataToObject(form));
  if (!result.ok) return errorState(result, form);
  revalidatePath(returnPath(returnTo));
  return undefined;
}

export async function markThreadReadAction(connectionId: string): Promise<void> {
  const user = await requireUser();
  const result = await markThreadRead(user, connectionId);
  if (result.ok && result.data.updated > 0) refreshTutoring();
}
