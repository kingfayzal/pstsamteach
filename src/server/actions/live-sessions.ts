"use server";

import { revalidatePath } from "next/cache";
import type { CallMessage } from "@/lib/live-sessions";
import { callChatLimiter, liveJoinLimiter, messageLimiter } from "@/server/auth/rate-limit";
import { requireUser } from "@/server/auth/session";
import { listCallMessages } from "@/server/queries/live-sessions";
import { joinLiveSession, loadCallMessages, sendCallMessage } from "@/server/services/live-sessions";

type Failure = { ok: false; message: string };

const SLOW_DOWN: Failure = { ok: false, message: "That's a lot of requests in a short time. Wait a minute and try again." };

/** A token for this session's video room, minted only after the service's checks pass. */
export async function joinLiveSessionAction(sessionId: string): Promise<{ ok: true; token: string; serverUrl: string; closesInMs: number } | Failure> {
  const user = await requireUser();
  if (!(await liveJoinLimiter.hit(`live-join:${user.id}`)).allowed) return SLOW_DOWN;
  const result = await joinLiveSession(user, sessionId);
  return result.ok ? { ok: true, ...result.data } : { ok: false, message: result.message };
}

/** The in-call chat is the pair's normal message thread, so nothing said there is lost. */
export async function loadCallMessagesAction(sessionId: string, markRead: boolean): Promise<{ ok: true; messages: CallMessage[] } | Failure> {
  const user = await requireUser();
  if (!(await callChatLimiter.hit(`call-chat:${user.id}`)).allowed) return SLOW_DOWN;
  const result = await loadCallMessages(user, sessionId, { markRead: markRead === true });
  if (!result.ok) return { ok: false, message: result.message };
  return { ok: true, messages: await listCallMessages(user.id, result.data.connectionId) };
}

export async function sendCallMessageAction(sessionId: string, body: string): Promise<{ ok: true; messages: CallMessage[] } | Failure> {
  const user = await requireUser();
  const limit = await messageLimiter.hit(`message:${user.id}`);
  if (!limit.allowed) return { ok: false, message: "You're sending messages very quickly. Wait a few minutes and try again." };
  const result = await sendCallMessage(user, sessionId, { body });
  if (!result.ok) return { ok: false, message: result.errors?.body?.[0] ?? result.message };
  const { connectionId } = result.data;
  revalidatePath(`/learn/teachers/${connectionId}`);
  revalidatePath(`/teach/students/${connectionId}`);
  return { ok: true, messages: await listCallMessages(user.id, connectionId) };
}
