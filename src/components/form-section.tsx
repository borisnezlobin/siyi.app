"use client";

import { CaretDown } from "@phosphor-icons/react";
import type { ReactNode } from "react";

/**
 * One collapsible group on the person forms. Collapsed content stays in the
 * DOM, so a field nobody expanded still saves with everything else.
 */
export function FormSection({
  title,
  summary,
  defaultOpen = false,
  children,
}: {
  title: string;
  summary: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  return (
    <details
      open={defaultOpen}
      className="group rounded-[1.75rem] bg-white shadow-card ring-1 ring-black/[0.035]"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-[1.75rem] px-5 py-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral sm:px-6">
        <span className="min-w-0">
          <span className="block text-sm font-bold">{title}</span>
          <span className="mt-0.5 block truncate text-xs text-ink-muted">
            {summary}
          </span>
        </span>
        <CaretDown
          size={17}
          className="shrink-0 text-ink-muted transition-transform group-open:rotate-180"
          aria-hidden="true"
        />
      </summary>
      <div className="px-5 pb-5 sm:px-6 sm:pb-6">{children}</div>
    </details>
  );
}
