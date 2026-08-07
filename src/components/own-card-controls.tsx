"use client";

import { Check, SpinnerGap } from "@phosphor-icons/react";
import { useState } from "react";
import { CollegeInput } from "@/components/college-input";
import { getApiResponseError } from "@/lib/http";
import { ownCardFields, ownCardLabels, type OwnCard } from "@/lib/own-card";

const inputClassName =
  "mt-1.5 h-12 w-full rounded-2xl border border-black/10 bg-white px-4 text-sm text-ink outline-none transition placeholder:text-ink/35 focus:border-coral focus:ring-2 focus:ring-coral/20";
const labelClassName = "block text-xs font-semibold text-ink-muted";

const placeholders: Partial<Record<(typeof ownCardFields)[number], string>> = {
  fullName: "Boris Nezlobin",
  preferredName: "Boris",
  phoneNumber: "(555) 555-0123",
  email: "you@example.edu",
  instagramUsername: "@username",
  discordUsername: "username",
  birthday: "2005-04-12",
  hometown: "Berkeley, California",
  major: "Computer Science",
  graduationYear: "2027",
  dormOrResidence: "Unit 2",
};

/**
 * Your own details, kept so you can hand them over without typing them again.
 * Nothing here is shown to anyone until the switch is on, and even then adding
 * someone only ever offers to copy them in.
 */
export function OwnCardControls({
  initialCard,
  initialEnabled,
}: {
  initialCard: OwnCard;
  initialEnabled: boolean;
}) {
  const [card, setCard] = useState<OwnCard>(initialCard);
  const [enabled, setEnabled] = useState(initialEnabled);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  async function save(overrides?: { enabled?: boolean }) {
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/settings/own-card", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          card,
          enabled: overrides?.enabled ?? enabled,
        }),
      });
      if (!response.ok) {
        throw new Error(
          await getApiResponseError(response, "That could not be saved."),
        );
      }
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2200);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error ? caughtError.message : "That could not be saved.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-4 rounded-2xl bg-porcelain p-4">
        <div>
          <p className="text-xs font-semibold text-ink">
            Include my card in links I share
          </p>
          <p className="mt-1 text-[11px] leading-4 text-ink-muted">
            When you share someone else&apos;s card, yours is offered alongside
            it so they can add you back. Separate from your page above.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label="Include my card in links I share"
          onClick={() => {
            const next = !enabled;
            setEnabled(next);
            void save({ enabled: next });
          }}
          className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral focus-visible:ring-offset-2 ${
            enabled ? "bg-sage-strong" : "bg-ink/15"
          }`}
        >
          <span
            className={`absolute top-0.5 size-5 rounded-full bg-white shadow-sm transition-all ${
              enabled ? "left-[1.375rem]" : "left-0.5"
            }`}
          />
        </button>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        {ownCardFields.map((field) => (
          <label key={field} className={labelClassName}>
            {ownCardLabels[field]}
            {field === "university" ? (
              <CollegeInput
                name={field}
                defaultValue={card[field] ?? ""}
                className={inputClassName}
                onValueChange={(value) =>
                  setCard((current) => ({ ...current, [field]: value }))
                }
              />
            ) : (
              <input
                value={card[field] ?? ""}
                onChange={(event) =>
                  setCard((current) => ({ ...current, [field]: event.target.value }))
                }
                placeholder={placeholders[field]}
                maxLength={200}
                className={inputClassName}
              />
            )}
          </label>
        ))}
      </div>

      {error ? <p className="mt-4 text-sm text-coral-strong">{error}</p> : null}

      <button
        type="button"
        onClick={() => void save()}
        disabled={saving}
        className="mt-5 inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-ink px-6 text-sm font-semibold text-white transition-colors hover:bg-ink/90 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral focus-visible:ring-offset-2"
      >
        {saving ? (
          <SpinnerGap size={16} className="animate-spin" aria-hidden="true" />
        ) : saved ? (
          <Check size={16} weight="bold" aria-hidden="true" />
        ) : null}
        {saved ? "Saved" : "Save my details"}
      </button>
    </div>
  );
}
