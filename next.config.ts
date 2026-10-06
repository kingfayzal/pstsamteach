import type { NextConfig } from "next";
import { assertEmailReadyForDeploy } from "./src/lib/email/config";
import { parseLiveKitConfig } from "./src/lib/live-sessions";
import { securityHeaderRules } from "./src/lib/security-headers";

const isDev = process.env.NODE_ENV !== "production";

// Throws on a half-finished LiveKit setup, so a bad deploy fails at build time.
const liveKit = parseLiveKitConfig(process.env);
// Same for email: a production deploy that can't send would leave nobody able to confirm an address or reset a password.
assertEmailReadyForDeploy(process.env);

const nextConfig: NextConfig = {
  // Lets the E2E server build into its own folder alongside a running dev server.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  poweredByHeader: false,
  // Put metadata in the first <head> for every visitor instead of streaming it.
  // Streamed metadata was rendered twice once the page hydrated (two titles, two
  // share images), and link-preview crawlers want it in the head anyway.
  htmlLimitedBots: /.*/,
  experimental: {
    // Teacher photos are capped at 2 MB; leave room for multipart overhead.
    serverActions: { bodySizeLimit: "3mb" },
  },
  async headers() {
    return securityHeaderRules({ isDev, liveKitUrl: liveKit?.url });
  },
};

export default nextConfig;
