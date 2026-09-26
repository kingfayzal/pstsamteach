const MAX_SLUG_LENGTH = 60;

export function slugify(input: string, fallback = "course"): string {
  const slug = input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/g, "");
  return slug || fallback;
}

export function withSuffix(slug: string, suffix: string): string {
  return `${slug}-${suffix}`;
}

export function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 6);
}
