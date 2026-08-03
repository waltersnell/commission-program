"use client";

import { useId, useState, type ReactNode } from "react";

export function AdminPanel({ title, children, initialOpen = false }: { title: string; children: ReactNode; initialOpen?: boolean }) {
  const [open, setOpen] = useState(initialOpen);
  const contentId = useId();

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
