import { z } from "zod";
import { formatMinutes } from "./format";

/** People can come into the room a little early to check their camera and microphone. */
export const JOIN_OPENS_MINUTES_BEFORE = 10;
/** And rejoin for a while after the booked end, in case the session overruns or a connection drops. */
export const JOIN_CLOSES_MINUTES_AFTER = 15;

const MINUTE = 60_000;
const ROOM_PREFIX = "session-";
const SESSION_ID = /^[A-Za-z0-9]{1,64}$/;

/** Session ids arrive from URLs, server action arguments and webhooks; anything else is "not found". */
export const liveSessionIdSchema = z.string().regex(SESSION_ID);

type SessionTimes = { startsAt: Date; endsAt: Date; status: "REQUESTED" | "CONFIRMED" | "CANCELLED" };

export type RoomState = "cancelled" | "unconfirmed" | "upcoming" | "open" | "ended";

export function joinWindow({ startsAt, endsAt }: Pick<SessionTimes, "startsAt" | "endsAt">): { opensAt: Date; closesAt: Date } {
  return {
    opensAt: new Date(startsAt.getTime() - JOIN_OPENS_MINUTES_BEFORE * MINUTE),
    closesAt: new Date(endsAt.getTime() + JOIN_CLOSES_MINUTES_AFTER * MINUTE),
  };
}

/** Whether a session's video room can be joined right now. */
export function roomState(session: SessionTimes, now: Date): RoomState {
  if (session.status === "CANCELLED") return "cancelled";
  if (session.status !== "CONFIRMED") return "unconfirmed";
  const { opensAt, closesAt } = joinWindow(session);
  if (now < opensAt) return "upcoming";
  return now < closesAt ? "open" : "ended";
}

type Stay = { joinedAt: Date; leftAt: Date | null };

/**
 * Time someone spent in the room. Stays can overlap (a second tab, or a
 * reconnect that lands before the old connection times out), so they're merged
 * first. A stay with no recorded end counts up to `until`.
 */
function attendedMs(stays: Stay[], until: Date): number {
  const spans = stays
    .map((s) => [s.joinedAt.getTime(), Math.min((s.leftAt ?? until).getTime(), until.getTime())] as const)
    .filter(([start, end]) => end > start)
    .sort((a, b) => a[0] - b[0]);

  let total = 0;
  let current: [number, number] | null = null;
  for (const [start, end] of spans) {
    if (current && start <= current[1]) {
      current[1] = Math.max(current[1], end);
    } else {
      if (current) total += current[1] - current[0];
      current = [start, end];
    }
  }
  if (current) total += current[1] - current[0];
  return total;
}

export function attendedMinutes(stays: Stay[], until: Date): number {
  return Math.round(attendedMs(stays, until) / MINUTE);
}

function duration(ms: number): string {
  return ms < MINUTE ? "less than a minute" : formatMinutes(Math.round(ms / MINUTE));
}

/**
 * A line for past sessions: who was in the video room and for how long. Null when
 * nobody used the room, since they may have met on the backup link instead.
 * Pass the earlier of now and the room's closing time as `until`.
 */
export function attendanceNote(stays: (Stay & { userId: string })[], viewerId: string, otherName: string, until: Date): string | null {
  const mine = attendedMs(
    stays.filter((s) => s.userId === viewerId),
    until,
  );
  const theirs = attendedMs(
    stays.filter((s) => s.userId !== viewerId),
    until,
  );
  if (mine > 0 && theirs > 0) return `In the video room: you ${duration(mine)}, ${otherName} ${duration(theirs)}.`;
  if (mine > 0) return `In the video room: you ${duration(mine)}. ${otherName} didn't join.`;
  if (theirs > 0) return `In the video room: ${otherName} ${duration(theirs)}. You didn't join.`;
  return null;
}

/** A message in the in-call chat, which is the pair's ordinary message thread. */
export type CallMessage = { id: string; body: string; createdAt: Date; senderId: string };

/** Each session gets its own room, named after it, so a token for one can never open another. */
export function roomNameFor(sessionId: string): string {
  return `${ROOM_PREFIX}${sessionId}`;
}

export function sessionIdFromRoom(room: string): string | null {
  if (!room.startsWith(ROOM_PREFIX)) return null;
  const id = room.slice(ROOM_PREFIX.length);
  return SESSION_ID.test(id) ? id : null;
}

export type LiveKitConfig = {
  /** Where browsers connect: wss://… (ws:// only for a server on this machine). */
  url: string;
  /** The same server over HTTP(S), for server-side API calls and the CSP. */
  httpUrl: string;
  apiKey: string;
  apiSecret: string;
};

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

const configSchema = z.object({
  LIVEKIT_URL: z
    .string()
    .trim()
    .min(1, "LIVEKIT_URL is missing.")
    .transform((value, ctx) => {
      let url: URL;
      try {
        url = new URL(value);
      } catch {
        ctx.addIssue({ code: "custom", message: "LIVEKIT_URL isn't a valid URL." });
        return z.NEVER;
      }
      const secure = url.protocol === "wss:";
      const local = url.protocol === "ws:" && LOCAL_HOSTS.has(url.hostname);
      if (!secure && !local) {
        ctx.addIssue({ code: "custom", message: "LIVEKIT_URL must start with wss:// (ws:// is only for a server on this machine)." });
        return z.NEVER;
      }
      if ((url.pathname !== "/" && url.pathname !== "") || url.search || url.hash || url.username || url.password) {
        ctx.addIssue({ code: "custom", message: "LIVEKIT_URL should be just the server address, like wss://your-project.livekit.cloud." });
        return z.NEVER;
      }
      return url;
    }),
  LIVEKIT_API_KEY: z.string().trim().min(1, "LIVEKIT_API_KEY is missing."),
  LIVEKIT_API_SECRET: z.string().trim().min(1, "LIVEKIT_API_SECRET is missing."),
});

/**
 * Live video is optional: with none of the three variables set it is off and
 * sessions use the teacher's own meeting link. A partial or unsafe setup throws,
 * so a deploy fails loudly instead of quietly falling back.
 */
export function parseLiveKitConfig(env: Record<string, string | undefined>): LiveKitConfig | null {
  const raw = {
    LIVEKIT_URL: env.LIVEKIT_URL ?? "",
    LIVEKIT_API_KEY: env.LIVEKIT_API_KEY ?? "",
    LIVEKIT_API_SECRET: env.LIVEKIT_API_SECRET ?? "",
  };
  if (Object.values(raw).every((v) => v.trim() === "")) return null;

  const parsed = configSchema.safeParse(raw);
  if (!parsed.success) {
    // Issue messages are ours, so they never echo the secret back.
    throw new Error(`Live video is misconfigured: ${parsed.error.issues.map((i) => i.message).join(" ")}`);
  }
  const { LIVEKIT_URL: url, LIVEKIT_API_KEY: apiKey, LIVEKIT_API_SECRET: apiSecret } = parsed.data;
  return {
    url: `${url.protocol}//${url.host}`,
    httpUrl: `${url.protocol === "wss:" ? "https:" : "http:"}//${url.host}`,
    apiKey,
    apiSecret,
  };
}
