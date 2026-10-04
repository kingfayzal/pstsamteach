import { VIDEO_EMBED_ORIGINS } from "./video";

type Header = { key: string; value: string };
type HeaderRule = { source: string; headers: Header[] };

/** Session rooms are the only pages that may use the camera, microphone or screen sharing. */
export const LIVE_ROOM_SOURCE = "/sessions/:path*";

const LIVEKIT_CLOUD = ".livekit.cloud";

/**
 * Where the room page may open connections. LiveKit Cloud moves clients between
 * regional hosts under livekit.cloud; a self-hosted server is allowed exactly.
 */
export function liveKitConnectSources(liveKitUrl: string): string[] {
  const url = new URL(liveKitUrl);
  const secure = url.protocol === "wss:";
  if (secure && url.hostname.endsWith(LIVEKIT_CLOUD)) return [`wss://*${LIVEKIT_CLOUD}`, `https://*${LIVEKIT_CLOUD}`];
  return [`${url.protocol}//${url.host}`, `${secure ? "https:" : "http:"}//${url.host}`];
}

function contentSecurityPolicy(isDev: boolean, extraConnect: string[] = []): string {
  const connect = ["'self'", ...(isDev ? ["ws:", "wss:"] : []), ...extraConnect];
  return [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src ${connect.join(" ")}`,
    `frame-src ${VIDEO_EMBED_ORIGINS.join(" ")}`,
    "frame-ancestors 'none'",
    "form-action 'self'",
    "base-uri 'self'",
    "object-src 'none'",
  ].join("; ");
}

/**
 * Headers for next.config.ts. When two rules match a path Next.js applies both
 * and the later one wins for a shared key, so the room rule only loosens what it names.
 */
export function securityHeaderRules({ isDev, liveKitUrl }: { isDev: boolean; liveKitUrl: string | null | undefined }): HeaderRule[] {
  const site: HeaderRule = {
    source: "/:path*",
    headers: [
      { key: "Content-Security-Policy", value: contentSecurityPolicy(isDev) },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), display-capture=(), geolocation=(), payment=()" },
      // No "preload": that is hard to undo; add it once the production domain is final.
      ...(isDev ? [] : [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }]),
    ],
  };
  if (!liveKitUrl) return [site];

  const room: HeaderRule = {
    source: LIVE_ROOM_SOURCE,
    headers: [
      { key: "Content-Security-Policy", value: contentSecurityPolicy(isDev, liveKitConnectSources(liveKitUrl)) },
      { key: "Permissions-Policy", value: "camera=(self), microphone=(self), display-capture=(self), geolocation=(), payment=()" },
    ],
  };
  return [site, room];
}
