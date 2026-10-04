import { createHash, randomBytes } from "node:crypto";
import { AccessToken } from "livekit-server-sdk";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const KEY = "route-key";
const SECRET = randomBytes(32).toString("hex");
const saved = { url: process.env.LIVEKIT_URL, key: process.env.LIVEKIT_API_KEY, secret: process.env.LIVEKIT_API_SECRET };

let POST: (request: Request) => Promise<Response>;

beforeAll(async () => {
  // The route reads its configuration from the environment the first time it's used.
  Object.assign(process.env, { LIVEKIT_URL: "ws://localhost:7880", LIVEKIT_API_KEY: KEY, LIVEKIT_API_SECRET: SECRET });
  ({ POST } = await import("@/app/api/livekit/webhook/route"));
});

afterAll(() => {
  for (const [name, value] of [
    ["LIVEKIT_URL", saved.url],
    ["LIVEKIT_API_KEY", saved.key],
    ["LIVEKIT_API_SECRET", saved.secret],
  ] as const) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});

async function signature(body: string, secret = SECRET) {
  const token = new AccessToken(KEY, secret);
  token.sha256 = createHash("sha256").update(body).digest("base64");
  return token.toJwt();
}

function post(body: BodyInit, headers: Record<string, string> = {}) {
  return POST(new Request("http://localhost/api/livekit/webhook", { method: "POST", body, headers, duplex: "half" } as RequestInit));
}

/** A body that arrives in chunks with no Content-Length, like a chunked upload. */
function chunked(totalBytes: number): ReadableStream<Uint8Array> {
  let sent = 0;
  return new ReadableStream({
    pull(controller) {
      if (sent >= totalBytes) return controller.close();
      const chunk = new Uint8Array(Math.min(16 * 1024, totalBytes - sent)).fill(97);
      sent += chunk.length;
      controller.enqueue(chunk);
    },
  });
}

describe("POST /api/livekit/webhook", () => {
  const event = JSON.stringify({ id: "EV_1", event: "room_started", createdAt: "1790000000", room: { name: "session-abc" } });

  it("accepts an event signed with our key", async () => {
    expect((await post(event, { authorization: await signature(event) })).status).toBe(200);
  });

  it("refuses unsigned or wrongly signed requests", async () => {
    expect((await post(event)).status).toBe(401);
    expect((await post(event, { authorization: await signature(event, randomBytes(32).toString("hex")) })).status).toBe(401);
    expect((await post(`${event} `, { authorization: await signature(event) })).status).toBe(401);
  });

  it("refuses oversized bodies, whether or not they declare their size", async () => {
    const authorization = await signature(event);
    expect((await post(event, { authorization, "content-length": String(10 * 1024 * 1024) })).status).toBe(413);
    expect((await post(chunked(200 * 1024), { authorization })).status).toBe(413);
  });
});
