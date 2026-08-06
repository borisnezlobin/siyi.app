"use client";

import clsx from "clsx";
import { customTypeIconFor } from "@/components/custom-type-icon";
import {
  customTypeIconKeys,
  type CustomTypeIconKey,
} from "@/lib/custom-type-icons";

type CustomTypeFieldsProps = {
  idPrefix: string;
  label: string;
  icon: CustomTypeIconKey | "";
  onLabelChange: (label: string) => void;
  onIconChange: (icon: CustomTypeIconKey | "") => void;
  recentLabels?: string[];
};

export function CustomTypeFields({
  idPrefix,
  label,
  icon,
  onLabelChange,
  onIconChange,
  recentLabels = [],
}: CustomTypeFieldsProps) {
  return (
    <div className="mt-4 rounded-2xl bg-porcelain p-4">
      <label
        className="block text-xs font-semibold text-ink-muted"
        htmlFor={`custom-label-${idPrefix}`}
      >
        What would you call it?
        <input
          id={`custom-label-${idPrefix}`}
          type="text"
          value={label}
          maxLength={40}
          placeholder="Went bouldering"
          onChange={(event) => onLabelChange(event.target.value)}
          className="mt-1.5 h-11 w-full rounded-2xl border border-black/10 bg-white px-4 text-sm text-ink outline-none transition focus:border-coral focus:ring-2 focus:ring-coral/20"
        />
      </label>

      {recentLabels.length ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {recentLabels.map((recent) => (
            <button
              key={recent}
              type="button"
              onClick={() => onLabelChange(recent)}
              className="rounded-full bg-white px-3 py-1.5 text-[11px] font-semibold text-ink-muted transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral"
            >
              {recent}
            </button>
          ))}
        </div>
      ) : null}

      <p className="mt-4 text-xs font-semibold text-ink-muted">
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
                  ? "bg-sage text-sage-strong"
                  : "bg-white text-ink-muted hover:bg-mist hover:text-ink",
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
