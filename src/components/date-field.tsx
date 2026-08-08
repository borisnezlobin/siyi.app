"use client";

import { CalendarBlank } from "@phosphor-icons/react";
import { useId, useState } from "react";
import { dateInputLabel, parseDateInput } from "@/lib/date-input";

/**
 * A date you can type however you like or pick off a calendar — the web half of
 * the same field the phone shows.
 *
 * Whatever is typed gets read back in words underneath, so nobody has to wonder
 * whether 03/04 was March or April. A native date input is still there behind
 * the "Pick a date" chip, because it is the only calendar a browser renders
 * well everywhere; it is a way in, not the only way in.
 *
 * Forms that read their values off the DOM get a hidden input carrying the
 * parsed date, so what is submitted is always YYYY-MM-DD however it was typed —
 * including when somebody submits without leaving the field.
 */
export function DateField({
  name,
  label,
  value,
  defaultValue = "",
  onChange,
  hint,
  max,
  min,
  className,
  inputClassName,
}: {
  name?: string;
  label: string;
  /** Controlled use. Leave unset to let the field keep its own text. */
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  hint?: string;
  max?: string;
  min?: string;
  className?: string;
  inputClassName?: string;
}) {
  const [ownValue, setOwnValue] = useState(defaultValue);
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerId = useId();

  const current = value ?? ownValue;
  const understood = dateInputLabel(current);
  const unreadable = current.trim().length > 0 && !understood;

  function update(next: string) {
    if (value === undefined) setOwnValue(next);
    onChange?.(next);
  }

  return (
    <div className={className}>
      <label className="block text-xs font-semibold text-ink-muted">
        {label}
        <input
          value={current}
          type="text"
          autoComplete="off"
          placeholder="March 18 2004, or 18/03/2004"
          className={inputClassName}
          onChange={(event) => update(event.target.value)}
          onBlur={() => {
            // Settle on the stored shape once they stop typing, so what is on
            // screen and what is saved never disagree.
            const parsed = parseDateInput(current);
            if (parsed && parsed !== current) update(parsed);
          }}
        />
      </label>

      {name ? <input type="hidden" name={name} value={parseDateInput(current) ?? ""} /> : null}

      <div className="mt-2 flex flex-wrap items-center gap-2.5">
        <button
          type="button"
          aria-expanded={pickerOpen}
          aria-controls={pickerId}
          onClick={() => setPickerOpen((open) => !open)}
          className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral ${
            pickerOpen ? "bg-ink text-white" : "bg-ink/[0.06] text-ink-muted hover:bg-ink/10"
          }`}
        >
          <CalendarBlank size={14} aria-hidden="true" />
          {pickerOpen ? "Close calendar" : "Pick a date"}
        </button>
        {understood ? (
          <p aria-live="polite" className="text-xs text-ink-muted">
            {understood}
          </p>
        ) : unreadable ? (
          <p aria-live="polite" className="text-xs text-coral-strong">
            Not a date we can read yet
          </p>
        ) : null}
      </div>

      {pickerOpen ? (
        <input
          id={pickerId}
          type="date"
          aria-label={`${label}: pick from a calendar`}
          value={parseDateInput(current) ?? ""}
          max={max}
          min={min}
          className={`mt-2 ${inputClassName ?? ""}`}
          onChange={(event) => update(event.target.value)}
        />
      ) : null}

      {hint ? <p className="mt-1.5 text-xs text-ink-muted">{hint}</p> : null}
    </div>
  );
}
