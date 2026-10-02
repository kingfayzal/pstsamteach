import { describe, expect, it } from "vitest";
import { telHref } from "@/lib/site";

describe("telHref", () => {
  it("keeps only the digits and a leading plus", () => {
    expect(telHref("+1 (240) 302-9182")).toBe("tel:+12403029182");
  });

  it("handles numbers written without a country code", () => {
    expect(telHref("240.302.9182")).toBe("tel:2403029182");
  });
});
