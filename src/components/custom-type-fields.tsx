"use client";

import clsx from "clsx";
import { useEffect, useState } from "react";
import { customTypeIconFor } from "@/components/custom-type-icon";
import {
  customTypeIconKeys,
  type CustomTypeIconKey,
} from "@/lib/custom-type-icons";

/**
 * Only entries the user named themselves get an icon. The names they have used
 * before are offered back to them so the same evening out does not end up
 * spelled three different ways.
 */

export function useRecentCustomLabels(enabled: boolean) {
  const [labels, setLabels] = useState<string[]>([]);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    fetch("/api/custom-labels")
      .then((response) => (response.ok ? response.json() : null))
      .then((body) => {
        if (!cancelled && Array.isArray(body?.labels)) setLabels(body.labels);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return labels;
}

export function CustomTypeIconPicker({
  icon,
  onIconChange,
}: {
  icon: CustomTypeIconKey | "";
  onIconChange: (icon: CustomTypeIconKey | "") => void;
}) {
  return (
    <div className="mt-5">
      <p className="text-xs font-semibold text-ink-muted">
        Pick an icon <span className="font-normal">(optional)</span>
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {customTypeIconKeys.map((key) => {
          const Icon = customTypeIconFor(key);
          const active = icon === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onIconChange(active ? "" : key)}
              className={clsx(
                "grid size-9 place-items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral",
                active
                  ? "bg-ink text-white"
                  : "bg-porcelain text-ink-muted hover:text-ink",
              )}
              aria-pressed={active}
              aria-label={`Use the ${key} icon`}
            >
              <Icon size={17} weight={active ? "fill" : "regular"} aria-hidden="true" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
