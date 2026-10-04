import { describe, expect, it } from "vitest";
import {
  attendanceNote,
  attendedMinutes,
  JOIN_CLOSES_MINUTES_AFTER,
  JOIN_OPENS_MINUTES_BEFORE,
  joinWindow,
  liveSessionIdSchema,
  parseLiveKitConfig,
  roomNameFor,
  roomState,
  sessionIdFromRoom,
} from "@/lib/live-sessions";

const START = new Date("2026-10-05T16:00:00.000Z");
const END = new Date("2026-10-05T16:50:00.000Z");
const MINUTE = 60_000;
const at = (base: Date, minutes: number) => new Date(base.getTime() + minutes * MINUTE);
const confirmed = { startsAt: START, endsAt: END, status: "CONFIRMED" as const };

describe("joinWindow", () => {
  it("opens shortly before the start and closes a little after the end", () => {
    expect(joinWindow(confirmed)).toEqual({
      opensAt: at(START, -JOIN_OPENS_MINUTES_BEFORE),
      closesAt: at(END, JOIN_CLOSES_MINUTES_AFTER),
    });
  });
});

describe("roomState", () => {
  it.each([
    ["an hour before", at(START, -60), "upcoming"],
    ["just before the room opens", at(START, -JOIN_OPENS_MINUTES_BEFORE - 1), "upcoming"],
    ["when the room opens", at(START, -JOIN_OPENS_MINUTES_BEFORE), "open"],
    ["during the session", at(START, 20), "open"],
    ["in the grace period after the end", at(END, JOIN_CLOSES_MINUTES_AFTER - 1), "open"],
    ["when the grace period ends", at(END, JOIN_CLOSES_MINUTES_AFTER), "ended"],
    ["the next day", at(END, 24 * 60), "ended"],
  ])("is %s -> %s", (_label, now, expected) => {
    expect(roomState(confirmed, now)).toBe(expected);
  });

  it("never opens for cancelled or unconfirmed sessions", () => {
    expect(roomState({ ...confirmed, status: "CANCELLED" }, at(START, 5))).toBe("cancelled");
    expect(roomState({ ...confirmed, status: "REQUESTED" }, at(START, 5))).toBe("unconfirmed");
  });
});

describe("attendedMinutes", () => {
  const stay = (from: number, to: number | null) => ({ joinedAt: at(START, from), leftAt: to === null ? null : at(START, to) });
  const until = at(END, JOIN_CLOSES_MINUTES_AFTER);

  it("adds up separate stays", () => {
    expect(attendedMinutes([stay(0, 20), stay(25, 50)], until)).toBe(45);
  });

  it("counts overlapping stays once, such as a second tab or a reconnect", () => {
    expect(attendedMinutes([stay(0, 30), stay(10, 40), stay(39, 50)], until)).toBe(50);
  });

  it("counts someone still in the room up to the cut-off", () => {
    expect(attendedMinutes([stay(40, null)], at(START, 45))).toBe(5);
    expect(attendedMinutes([stay(0, 200)], until)).toBe(50 + JOIN_CLOSES_MINUTES_AFTER);
  });

  it("is zero with no stays", () => {
    expect(attendedMinutes([], until)).toBe(0);
    expect(attendedMinutes([stay(10, 10)], until)).toBe(0);
  });
});

describe("attendanceNote", () => {
  const ME = "user-me";
  const THEM = "user-them";
  const stay = (userId: string, from: number, to: number | null) => ({ userId, joinedAt: at(START, from), leftAt: to === null ? null : at(START, to) });
  const until = at(END, JOIN_CLOSES_MINUTES_AFTER);

  it("says how long each person was in the room, up to when it closes", () => {
    // Kemi's second stay runs past the room closing (65 minutes in), so it counts 51–65.
    expect(attendanceNote([stay(ME, 0, 52), stay(THEM, 2, 50), stay(THEM, 51, 72)], ME, "Kemi", until)).toBe("In the video room: you 52 min, Kemi 1 hr 2 min.");
  });

  it("says who didn't join", () => {
    expect(attendanceNote([stay(ME, 0, 30)], ME, "Kemi", until)).toBe("In the video room: you 30 min. Kemi didn't join.");
    expect(attendanceNote([stay(THEM, 0, 30)], ME, "Kemi", until)).toBe("In the video room: Kemi 30 min. You didn't join.");
  });

  it("counts a stay of under a minute as joining", () => {
    const blip = { userId: THEM, joinedAt: at(START, 3), leftAt: new Date(at(START, 3).getTime() + 20_000) };
    expect(attendanceNote([stay(ME, 0, 30), blip], ME, "Kemi", until)).toBe("In the video room: you 30 min, Kemi less than a minute.");
  });

  it("says nothing when the room wasn't used, since they may have met on the backup link", () => {
    expect(attendanceNote([], ME, "Kemi", until)).toBeNull();
  });
});

describe("room names", () => {
  it("round-trips a session id", () => {
    expect(roomNameFor("cmg1x2y3z0000abcd1234efgh")).toBe("session-cmg1x2y3z0000abcd1234efgh");
    expect(sessionIdFromRoom("session-cmg1x2y3z0000abcd1234efgh")).toBe("cmg1x2y3z0000abcd1234efgh");
  });

  it.each(["", "session-", "other-abc", "session-abc/def", "session-../x", `session-${"a".repeat(65)}`])("rejects %j", (room) => {
    expect(sessionIdFromRoom(room)).toBeNull();
  });

  it("only accepts session ids that could be real", () => {
    expect(liveSessionIdSchema.safeParse("cmg1x2y3z0000abcd1234efgh").success).toBe(true);
    for (const value of ["", "a/b", "x".repeat(65), 42, null, { id: "x" }]) expect(liveSessionIdSchema.safeParse(value).success).toBe(false);
  });
});

describe("parseLiveKitConfig", () => {
  const cloud = { LIVEKIT_URL: "wss://xcel-abc123.livekit.cloud", LIVEKIT_API_KEY: "APIabc123", LIVEKIT_API_SECRET: "s".repeat(40) };

  it("is off when nothing is set", () => {
    expect(parseLiveKitConfig({})).toBeNull();
    expect(parseLiveKitConfig({ LIVEKIT_URL: "", LIVEKIT_API_KEY: " ", LIVEKIT_API_SECRET: "" })).toBeNull();
  });

  it("reads a LiveKit Cloud project", () => {
    expect(parseLiveKitConfig(cloud)).toEqual({
      url: "wss://xcel-abc123.livekit.cloud",
      httpUrl: "https://xcel-abc123.livekit.cloud",
      apiKey: "APIabc123",
      apiSecret: "s".repeat(40),
    });
  });

  it("allows plain ws:// only for a server on this machine", () => {
    const local = { LIVEKIT_URL: "ws://localhost:7880", LIVEKIT_API_KEY: "devkey", LIVEKIT_API_SECRET: "secret" };
    expect(parseLiveKitConfig(local)).toMatchObject({ url: "ws://localhost:7880", httpUrl: "http://localhost:7880" });
    expect(() => parseLiveKitConfig({ ...local, LIVEKIT_URL: "ws://livekit.example.com" })).toThrow(/wss:\/\//);
  });

  it.each([
    [{ LIVEKIT_URL: "https://xcel.livekit.cloud" }, /wss:\/\//],
    [{ LIVEKIT_URL: "not a url" }, /LIVEKIT_URL/],
    [{ LIVEKIT_URL: "wss://xcel.livekit.cloud/some/path" }, /LIVEKIT_URL/],
    [{ LIVEKIT_API_KEY: "" }, /LIVEKIT_API_KEY/],
    [{ LIVEKIT_API_SECRET: "" }, /LIVEKIT_API_SECRET/],
  ])("refuses a half-finished or unsafe setup (%j)", (override, message) => {
    expect(() => parseLiveKitConfig({ ...cloud, ...override })).toThrow(message);
  });

  it("never puts the secret in its error messages", () => {
    try {
      parseLiveKitConfig({ ...cloud, LIVEKIT_URL: "http://nope" });
      expect.unreachable();
    } catch (error) {
      expect(String(error)).not.toContain(cloud.LIVEKIT_API_SECRET);
    }
  });
});
