const YOUTUBE_HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com", "youtube-nocookie.com", "www.youtube-nocookie.com"]);
const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
const VIMEO_HOSTS = new Set(["vimeo.com", "www.vimeo.com", "player.vimeo.com"]);
const VIMEO_ID = /^\d{6,12}$/;

/** Hosts that lesson videos may be embedded from. Mirrors the CSP frame-src. */
export const VIDEO_EMBED_ORIGINS = ["https://www.youtube-nocookie.com", "https://player.vimeo.com"] as const;

function parseUrl(raw: string): URL | null {
  try {
    const url = new URL(raw.trim());
    return url.protocol === "https:" || url.protocol === "http:" ? url : null;
  } catch {
    return null;
  }
}

function youtubeId(url: URL): string | null {
  if (url.hostname === "youtu.be") return url.pathname.slice(1);
  if (!YOUTUBE_HOSTS.has(url.hostname)) return null;
  if (url.pathname === "/watch") return url.searchParams.get("v");
  const match = url.pathname.match(/^\/(?:embed|shorts)\/([^/]+)/);
  return match?.[1] ?? null;
}

function vimeoId(url: URL): string | null {
  if (!VIMEO_HOSTS.has(url.hostname)) return null;
  const segments = url.pathname.split("/").filter(Boolean);
  return segments.at(-1) ?? null;
}

/**
 * Convert a YouTube or Vimeo link into a privacy-friendly embed URL.
 * Anything else returns null, so arbitrary sites can never be framed.
 */
export function toEmbedUrl(raw: string): string | null {
  const url = parseUrl(raw);
  if (!url) return null;

  const yt = youtubeId(url);
  if (yt && YOUTUBE_ID.test(yt)) return `https://www.youtube-nocookie.com/embed/${yt}`;

  const vimeo = vimeoId(url);
  if (vimeo && VIMEO_ID.test(vimeo)) return `https://player.vimeo.com/video/${vimeo}`;

  return null;
}
