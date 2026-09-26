import { describe, expect, it } from "vitest";
import { navFor } from "@/lib/nav";
import { NOTICES, noticeFor } from "@/lib/notices";
import { ROLE_LABEL, STATUS_TONE, USER_STATUS_LABEL } from "@/lib/people";

describe("navFor", () => {
  it("gives each role its own navigation", () => {
    expect(navFor("STUDENT")[0].href).toBe("/learn");
    expect(navFor("TEACHER").map((n) => n.href)).toContain("/teach/marking");
    expect(navFor("ADMIN").map((n) => n.href)).toContain("/admin/review");
  });

  it("adds badge counts only where they're non-zero", () => {
    const nav = navFor("TEACHER", { "/teach/marking": 3, "/teach": 0 });
    expect(nav.find((n) => n.href === "/teach/marking")?.count).toBe(3);
    expect(nav.find((n) => n.href === "/teach")?.count).toBeUndefined();
  });
});

describe("noticeFor", () => {
  it("returns whitelisted messages only", () => {
    expect(noticeFor("marked")).toBe(NOTICES.marked);
    expect(noticeFor("<script>alert(1)</script>")).toBeNull();
    expect(noticeFor("toString")).toBeNull();
    expect(noticeFor(["marked"])).toBeNull();
  });
});

describe("people labels", () => {
  it("covers every role and status", () => {
    expect(Object.keys(ROLE_LABEL)).toEqual(["STUDENT", "TEACHER", "ADMIN"]);
    expect(USER_STATUS_LABEL.PENDING).toBe("Awaiting approval");
    expect(STATUS_TONE.SUSPENDED).toBe("bad");
  });
});
