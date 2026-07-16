"use client";

import { useId, useState, type ReactNode } from "react";

export function AdminPanel({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const contentId = useId();

  return (
    <section className="card p-4">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 text-left"
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
