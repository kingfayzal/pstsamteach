import "server-only";
import { parseLiveKitConfig } from "@/lib/live-sessions";
import { createLiveKitProvider } from "./livekit";
import type { VideoProvider } from "./provider";

export type { VideoEvent, VideoProvider } from "./provider";

let cached: VideoProvider | null | undefined;

/** The configured video service, or null when live video is off (sessions use meeting links). */
export function getVideoProvider(): VideoProvider | null {
  if (cached === undefined) {
    const config = parseLiveKitConfig(process.env);
    cached = config ? createLiveKitProvider(config) : null;
  }
  return cached;
}

export function isLiveVideoEnabled(): boolean {
  return getVideoProvider() !== null;
}
