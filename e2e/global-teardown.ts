import { spawnSync } from "node:child_process";

/**
 * Remove the E2E LiveKit container (scripts/e2e-livekit.mjs). Playwright stops
 * web servers on its own, but on Windows it can only kill the docker client,
 * which would leave the container running.
 */
export default function globalTeardown() {
  spawnSync("docker", ["rm", "-f", "pstsamteach-e2e-livekit"], { stdio: "ignore" });
}
