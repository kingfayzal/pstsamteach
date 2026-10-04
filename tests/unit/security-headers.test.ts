import { describe, expect, it } from "vitest";
import { liveKitConnectSources, securityHeaderRules } from "@/lib/security-headers";

type Rule = ReturnType<typeof securityHeaderRules>[number];

function header(rule: Rule | undefined, key: string): string | undefined {
  return rule?.headers.find((h) => h.key === key)?.value;
}

function directive(csp: string | undefined, name: string): string | undefined {
  return csp
    ?.split(";")
    .map((d) => d.trim())
    .find((d) => d.startsWith(`${name} `));
}

describe("liveKitConnectSources", () => {
  it("allows every LiveKit Cloud region, since the client is moved between them", () => {
    expect(liveKitConnectSources("wss://xcel-abc123.livekit.cloud")).toEqual(["wss://*.livekit.cloud", "https://*.livekit.cloud"]);
  });

  it("allows exactly a self-hosted server, port included", () => {
    expect(liveKitConnectSources("wss://rtc.xcelstudy.com")).toEqual(["wss://rtc.xcelstudy.com", "https://rtc.xcelstudy.com"]);
    expect(liveKitConnectSources("ws://localhost:7880")).toEqual(["ws://localhost:7880", "http://localhost:7880"]);
  });
});

describe("securityHeaderRules", () => {
  it("keeps camera and microphone off everywhere when live video isn't set up", () => {
    const rules = securityHeaderRules({ isDev: false, liveKitUrl: null });
    expect(rules).toHaveLength(1);
    expect(rules[0].source).toBe("/:path*");
    expect(header(rules[0], "Permissions-Policy")).toContain("camera=()");
    expect(header(rules[0], "Permissions-Policy")).toContain("microphone=()");
    expect(header(rules[0], "Permissions-Policy")).toContain("display-capture=()");
    expect(directive(header(rules[0], "Content-Security-Policy"), "connect-src")).toBe("connect-src 'self'");
    expect(header(rules[0], "Strict-Transport-Security")).toBeDefined();
  });

  it("opens camera, microphone, screen sharing and the LiveKit host on session rooms only", () => {
    const [site, room] = securityHeaderRules({ isDev: false, liveKitUrl: "wss://xcel-abc123.livekit.cloud" });

    expect(directive(header(site, "Content-Security-Policy"), "connect-src")).toBe("connect-src 'self'");
    expect(header(site, "Permissions-Policy")).toContain("camera=()");

    expect(room.source).toBe("/sessions/:path*");
    expect(directive(header(room, "Content-Security-Policy"), "connect-src")).toBe("connect-src 'self' wss://*.livekit.cloud https://*.livekit.cloud");
    expect(header(room, "Permissions-Policy")).toBe("camera=(self), microphone=(self), display-capture=(self), geolocation=(), payment=()");
    // Everything else about the policy stays as strict as the rest of the site.
    expect(directive(header(room, "Content-Security-Policy"), "frame-ancestors")).toBe("frame-ancestors 'none'");
    expect(directive(header(room, "Content-Security-Policy"), "script-src")).toBe(directive(header(site, "Content-Security-Policy"), "script-src"));
  });

  it("lets the dev server's hot reload connect in development only", () => {
    const [dev] = securityHeaderRules({ isDev: true, liveKitUrl: null });
    expect(directive(header(dev, "Content-Security-Policy"), "connect-src")).toBe("connect-src 'self' ws: wss:");
    expect(directive(header(dev, "Content-Security-Policy"), "script-src")).toContain("'unsafe-eval'");
    expect(header(dev, "Strict-Transport-Security")).toBeUndefined();
  });
});
