/**
 * Starts the local LiveKit server from docker-compose.yml with the key and
 * secret in .env, after checking they're there: without them LiveKit fails to
 * start with an error that doesn't say why.
 */
import "dotenv/config";
import { spawnSync } from "node:child_process";

const key = process.env.LIVEKIT_API_KEY?.trim();
const secret = process.env.LIVEKIT_API_SECRET?.trim();

if (!key || !secret) {
  console.error("Set LIVEKIT_API_KEY and LIVEKIT_API_SECRET in .env first (see .env.example).");
  process.exit(1);
}
if (secret.length < 32) {
  console.error("LIVEKIT_API_SECRET should be at least 32 characters. Generate one with `openssl rand -hex 32`.");
  process.exit(1);
}

const result = spawnSync("docker", ["compose", "up", "-d", "livekit"], { stdio: "inherit" });
process.exit(result.status ?? 1);
