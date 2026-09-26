"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavItem = { href: string; label: string; exact?: boolean; count?: number };

function isActive(pathname: string, item: NavItem): boolean {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function NavLinks({ items, orientation = "vertical" }: { items: NavItem[]; orientation?: "vertical" | "horizontal" }) {
  const pathname = usePathname();
  return (
    <ul className={orientation === "vertical" ? "space-y-0.5" : "flex flex-wrap gap-x-6 gap-y-2"}>
      {items.map((item) => {
        const active = isActive(pathname, item);
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={
                orientation === "vertical"
                  ? `flex items-center justify-between rounded-control px-3 py-2 text-base font-bold ${active ? "bg-sheet text-ink shadow-[inset_3px_0_0_var(--color-ink)]" : "text-ink-soft hover:bg-sheet hover:text-ink"}`
                  : `text-base font-bold underline-offset-[6px] ${active ? "text-ink underline decoration-ink decoration-2" : "text-ink-soft hover:text-ink hover:underline hover:decoration-rule"}`
              }
            >
              <span>{item.label}</span>
              {item.count ? (
                <span className="figures rounded-full bg-ink px-2 py-0.5 text-xs font-bold text-paper" aria-label={`${item.count} waiting`}>
                  {item.count}
                </span>
              ) : null}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
