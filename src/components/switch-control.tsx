"use client";

import clsx from "clsx";

type SwitchControlProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
};

export function SwitchControl({
  checked,
  onChange,
  label,
  description,
  disabled = false,
}: SwitchControlProps) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 py-3">
      <span className="min-w-0">
        <span className="block text-sm font-semibold">{label}</span>
        {description ? (
          <span className="mt-1 block text-xs leading-5 text-ink-muted">
            {description}
          </span>
        ) : null}
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        disabled={disabled}
        className="sr-only"
      />
      <span
        className={clsx(
          "relative h-7 w-12 shrink-0 rounded-full p-1 transition-colors",
          checked ? "bg-sage-strong" : "bg-ink/12",
          disabled && "opacity-45",
        )}
        aria-hidden="true"
      >
        <span
          className={clsx(
            "block size-5 rounded-full bg-white shadow-sm transition-transform",
            checked && "translate-x-5",
          )}
        />
      </span>
    </label>
  );
}
