"use client";

import { BellSlash, Check } from "@phosphor-icons/react";
import { useState } from "react";
import {
  isDefaultRelationshipLabel,
  maxRelationshipLabelLength,
  relationshipTierLabels,
} from "@/lib/relationship-labels";
import { relationshipStrengths, type RelationshipStrength } from "@/lib/types";

const inputClassName =
  "mt-1.5 h-12 w-full rounded-2xl border border-black/10 bg-white px-4 text-sm text-ink outline-none transition placeholder:text-ink/35 focus:border-coral focus:ring-2 focus:ring-coral/20";
const labelClassName = "block text-xs font-semibold text-ink-muted";

function chipClassName(selected: boolean) {
  return [
    "flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-semibold transition",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral",
    selected
      ? "bg-ink text-white"
      : "bg-mist text-ink-muted hover:bg-sage hover:text-sage-strong",
  ].join(" ");
}

export function RelationshipFields({
  personName,
  defaultStrength = 2,
  defaultLabel = null,
  defaultRemindersEnabled = true,
  defaultReminderIntervalDays = null,
}: {
  personName?: string;
  defaultStrength?: RelationshipStrength;
  defaultLabel?: string | null;
  defaultRemindersEnabled?: boolean;
  defaultReminderIntervalDays?: number | null;
}) {
  const [strength, setStrength] =
    useState<RelationshipStrength>(defaultStrength);
  const [customLabel, setCustomLabel] = useState(
    defaultLabel && !isDefaultRelationshipLabel(defaultLabel)
      ? defaultLabel
      : "",
  );
  const [remindersEnabled, setRemindersEnabled] = useState(
    defaultRemindersEnabled,
  );

  const usingCustomLabel = customLabel.trim().length > 0;
  const label = usingCustomLabel
    ? customLabel.trim()
    : relationshipTierLabels[strength];
  const who = personName ? personName : "them";

  return (
    <fieldset className="sm:col-span-2">
      <legend className={labelClassName}>What are they to you?</legend>
      <input type="hidden" name="relationshipStrength" value={strength} />
      <input type="hidden" name="relationshipLabel" value={label} />
      <input
        type="hidden"
        name="remindersEnabled"
        value={remindersEnabled ? "true" : "false"}
      />

      <div className="mt-2 flex flex-wrap gap-2">
        {relationshipStrengths.map((value) => {
          const selected = !usingCustomLabel && strength === value;
          return (
            <button
              key={value}
              type="button"
              aria-pressed={selected}
              onClick={() => {
                setStrength(value);
                setCustomLabel("");
              }}
              className={chipClassName(selected)}
            >
              {selected ? (
                <Check size={13} weight="bold" aria-hidden="true" />
              ) : null}
              {relationshipTierLabels[value]}
            </button>
          );
        })}
      </div>

      <label className={`${labelClassName} mt-4`}>
        Or call it something of your own
        <input
          value={customLabel}
          onChange={(event) => setCustomLabel(event.target.value)}
          maxLength={maxRelationshipLabelLength}
          placeholder="college roommate"
          className={inputClassName}
        />
      </label>

      <div className="mt-4 rounded-2xl bg-porcelain p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-ink">
              Remind me to keep in touch
            </p>
            <p className="mt-1 text-[11px] leading-4 text-ink-muted">
              {remindersEnabled
                ? "We nudge you when it has been a while."
                : `No nudges about ${who}. Birthdays and follow-ups still come through.`}
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={remindersEnabled}
            aria-label="Remind me to keep in touch"
            onClick={() => setRemindersEnabled((enabled) => !enabled)}
            className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral focus-visible:ring-offset-2 ${
              remindersEnabled ? "bg-sage-strong" : "bg-ink/15"
            }`}
          >
            <span
              className={`absolute top-0.5 size-5 rounded-full bg-white shadow-sm transition-all ${
                remindersEnabled ? "left-[1.375rem]" : "left-0.5"
              }`}
            />
          </button>
        </div>

        {remindersEnabled ? null : (
          <p className="mt-3 flex items-center gap-2 text-[11px] font-medium text-ink-muted">
            <BellSlash size={14} aria-hidden="true" />
            Reminder timing is paused until you switch this back on.
          </p>
        )}

        {/* Kept mounted while paused so an existing custom interval survives a save. */}
        <div
          className={
            remindersEnabled
              ? "mt-4 border-t border-black/5 pt-4"
              : "hidden"
          }
        >
          <p className={labelClassName}>How often should we nudge you?</p>
          <p className="mt-1 text-[11px] leading-4 text-ink-muted">
            {usingCustomLabel
              ? `“${label}” is your name for them. The pace below is what actually sets the timing.`
              : `Reminders follow your ${relationshipTierLabels[strength]} pace, which you can change in settings.`}
          </p>
          {usingCustomLabel ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {relationshipStrengths.map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={strength === value}
                  onClick={() => setStrength(value)}
                  className={chipClassName(strength === value)}
                >
                  {strength === value ? (
                    <Check size={13} weight="bold" aria-hidden="true" />
                  ) : null}
                  {relationshipTierLabels[value]} pace
                </button>
              ))}
            </div>
          ) : null}
          <label className={`${labelClassName} mt-4`}>
            Custom reminder interval
            <span className="mt-1 block text-[11px] font-normal leading-4 text-ink-muted">
              Leave blank to use the default for the pace you picked.
            </span>
            <div className="relative">
              <input
                name="reminderIntervalDays"
                type="number"
                min="1"
                max="3650"
                inputMode="numeric"
                defaultValue={defaultReminderIntervalDays ?? ""}
                className={`${inputClassName} pr-14`}
              />
              <span className="absolute right-4 top-[1.15rem] text-xs text-ink-muted">
                days
              </span>
            </div>
          </label>
        </div>
      </div>
    </fieldset>
  );
}
