import { describe, expect, it } from "vitest";
import { SITE, telHref } from "@/lib/site";

describe("SITE.url", () => {
  it("is a bare https origin, so share-image URLs resolve against the site root", () => {
    const url = new URL(SITE.url);
    expect(url.protocol).toBe("https:");
    expect(url.origin).toBe(SITE.url);
  });
});

describe("telHref", () => {
  it("keeps only the digits and a leading plus", () => {
    expect(telHref("+1 (240) 302-9182")).toBe("tel:+12403029182");
  });

  it("handles numbers written without a country code", () => {
    expect(telHref("240.302.9182")).toBe("tel:2403029182");
  });
});
