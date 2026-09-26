import type { CSSProperties } from "react";
import { initials } from "@/lib/format";

type Props = { name: string; photo: string | null; color?: string; size?: "sm" | "md" | "lg" | "xl"; className?: string };

const SIZES = { sm: "h-10 w-10 text-sm", md: "h-16 w-16 text-xl", lg: "h-28 w-28 text-3xl", xl: "h-40 w-40 text-5xl" };

/** A teacher's photo, or their initials on their subject colour. */
export function TeacherAvatar({ name, photo, color = "#15213F", size = "md", className = "" }: Props) {
  const box = `${SIZES[size]} shrink-0 overflow-hidden rounded-book ${className}`;
  if (photo) {
    // Served from our own route with a version in the URL; next/image adds nothing here.
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={photo} alt={`Photo of ${name}`} className={`${box} bg-rule-soft object-cover`} loading="lazy" decoding="async" />;
  }
  return (
    <span
      aria-hidden="true"
      className={`${box} inline-flex items-center justify-center bg-(--avatar) font-extrabold tracking-[-0.02em] text-white`}
      style={{ "--avatar": color } as CSSProperties}
    >
      {initials(name)}
    </span>
  );
}
