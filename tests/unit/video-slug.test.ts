import { describe, expect, it } from "vitest";
import { toEmbedUrl } from "@/lib/video";
import { slugify, withSuffix } from "@/lib/slug";

describe("toEmbedUrl", () => {
  it.each([
    ["https://www.youtube.com/watch?v=dQw4w9WgXcQ", "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"],
    ["https://youtu.be/dQw4w9WgXcQ?t=10", "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"],
    ["https://youtube.com/embed/dQw4w9WgXcQ", "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"],
    ["https://m.youtube.com/shorts/dQw4w9WgXcQ", "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"],
    ["https://vimeo.com/76979871", "https://player.vimeo.com/video/76979871"],
  ])("turns %s into an embed URL", (input, expected) => {
    expect(toEmbedUrl(input)).toBe(expected);
  });

  it.each([
    "javascript:alert(1)",
    "https://evil.example.com/watch?v=dQw4w9WgXcQ",
    "https://www.youtube.com/watch?v=short",
    "not a url",
    "",
  ])("rejects %s", (input) => {
    expect(toEmbedUrl(input)).toBeNull();
  });
});

describe("slugify", () => {
  it("lowercases and hyphenates", () => {
    expect(slugify("Algebra from the Ground Up!")).toBe("algebra-from-the-ground-up");
  });

  it("strips accents and symbols", () => {
    expect(slugify("Café & Crème: Pâtisserie")).toBe("cafe-creme-patisserie");
  });

  it("caps the length without leaving a trailing hyphen", () => {
    const slug = slugify("a ".repeat(80));
    expect(slug.length).toBeLessThanOrEqual(60);
    expect(slug.endsWith("-")).toBe(false);
  });

  it("falls back when nothing usable is left", () => {
    expect(slugify("!!!")).toBe("course");
  });
});

describe("withSuffix", () => {
  it("appends a suffix", () => {
    expect(withSuffix("algebra", "x7k2")).toBe("algebra-x7k2");
  });
});
