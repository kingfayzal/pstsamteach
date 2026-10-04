/**
 * A throwaway LiveKit server in Docker for the E2E suite, started by
 * playwright.config.ts and removed by e2e/global-teardown.ts. It uses its own
 * ports so it never clashes with the development server from docker-compose.yml.
 * The API key and secret come in through LIVEKIT_KEYS, never on the command line.
 */
import { spawn, spawnSync } from "node:child_process";

// Keep in step with e2e/global-teardown.ts.
const CONTAINER = "pstsamteach-e2e-livekit";
const IMAGE = "livekit/livekit-server:v1.13.7";
const HTTP_PORT = 7980;
const RTC_TCP_PORT = 7981;
const RTC_UDP_PORT = 7982;

// Media ports must be the same inside and outside the container: browsers are
// told to send to 127.0.0.1 on whatever port LiveKit itself listens on.
const config = `port: ${HTTP_PORT}\nrtc:\n  tcp_port: ${RTC_TCP_PORT}\n  udp_port: ${RTC_UDP_PORT}\n`;

if (!process.env.LIVEKIT_KEYS) {
  console.error("LIVEKIT_KEYS is not set; run this through `npm run test:e2e`.");
  process.exit(1);
}

// A previous run that was killed hard may have left its container behind.
spawnSync("docker", ["rm", "-f", CONTAINER], { stdio: "ignore" });

const server = spawn(
  "docker",
  [
    "run",
    "--rm",
    "--name",
    CONTAINER,
    "-p",
    `127.0.0.1:${HTTP_PORT}:${HTTP_PORT}`,
    "-p",
    `127.0.0.1:${RTC_TCP_PORT}:${RTC_TCP_PORT}`,
    "-p",
    `127.0.0.1:${RTC_UDP_PORT}:${RTC_UDP_PORT}/udp`,
    "-e",
    "LIVEKIT_KEYS",
    "-e",
    "LIVEKIT_CONFIG",
    IMAGE,
    "--dev",
    "--bind",
    "0.0.0.0",
    "--node-ip",
    "127.0.0.1",
  ],
  { stdio: "inherit", env: { ...process.env, LIVEKIT_CONFIG: config } },
);

const stop = () => {
  spawnSync("docker", ["rm", "-f", CONTAINER], { stdio: "ignore" });
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
server.on("exit", (code) => process.exit(code ?? 0));
