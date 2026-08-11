"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isActivePath, type NavItem } from "@/lib/navigation";

export function DesktopNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname() ?? "";

  return (
    <nav className="desktop-nav mx-auto max-w-7xl gap-1 overflow-x-auto px-4 pb-3">
      {items.map((item) => (
        <Link key={item.href} href={item.href} className={isActivePath(pathname, item.href) ? "nav-link nav-link-active" : "nav-link"}>
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
