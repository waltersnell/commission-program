"use client";

import Link from "next/link";
import { useState } from "react";

type NavItem = {
  href: string;
  label: string;
  active: boolean;
};

export function MobileNav({ items }: { items: NavItem[] }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mobile-nav">
      <button
        type="button"
        className="hamburger-button"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span aria-hidden="true" />
        <span aria-hidden="true" />
        <span aria-hidden="true" />
      </button>
      {open ? (
        <nav className="mobile-nav-panel" aria-label="Mobile navigation">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={item.active ? "nav-link nav-link-active" : "nav-link"}
              onClick={() => setOpen(false)}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      ) : null}
    </div>
  );
}
