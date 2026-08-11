"use client";

import { useId, useState, type ReactNode } from "react";

export function AdminPanel({
  title,
  children,
  initialOpen = false,
  collapsible = true,
}: {
  title: string;
  children: ReactNode;
  initialOpen?: boolean;
  collapsible?: boolean;
}) {
  const [open, setOpen] = useState(initialOpen);
  const contentId = useId();

  if (!collapsible) {
    return (
      <section className="card p-4">
        <h2 className="section-title">{title}</h2>
        <div className="mt-4">{children}</div>
      </section>
    );
  }

  return (
    <section className="card p-4">
      <button
        type="button"
        className="admin-panel-trigger"
        aria-expanded={open}
        aria-controls={contentId}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="section-title mb-0">{title}</span>
        <span className="badge badge-gray">{open ? "Close" : "Open"}</span>
      </button>
      {open ? (
        <div id={contentId} className="mt-4">
          {children}
        </div>
      ) : null}
    </section>
  );
}
