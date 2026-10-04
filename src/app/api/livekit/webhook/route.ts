import { receiveVideoWebhook } from "@/server/services/live-sessions";

/** Webhooks are a few hundred bytes; anything far bigger isn't from LiveKit. */
const MAX_BODY_BYTES = 64 * 1024;

/** The body as text, or null as soon as it passes the limit, without buffering the rest. */
async function readCapped(request: Request): Promise<string | null> {
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) return null;
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BODY_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}

/**
 * LiveKit posts room events here (set the URL in the LiveKit project's webhook
 * settings). The signature, not a session cookie, proves who sent it, so it must
 * be checked against the raw body before anything is parsed.
 */
export async function POST(request: Request) {
  const authorization = request.headers.get("authorization");
  if (!authorization) return new Response(null, { status: 401 });
  const body = await readCapped(request);
  if (body === null) return new Response(null, { status: 413 });

  const result = await receiveVideoWebhook(body, authorization);
  if (result.ok) return new Response(null, { status: 200 });
  return new Response(null, { status: result.code === "NOT_FOUND" ? 404 : 401 });
}
