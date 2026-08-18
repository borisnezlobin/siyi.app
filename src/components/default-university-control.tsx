"use client";

import { Check, SpinnerGap } from "@phosphor-icons/react";
import { useState } from "react";
import { CollegeInput } from "@/components/college-input";
import { useUniversitySuggestion } from "@/components/use-university-suggestion";
import { getApiResponseError } from "@/lib/http";

const inputClassName =
  "mt-1.5 h-12 w-full rounded-2xl border border-black/10 bg-white px-4 text-sm text-ink outline-none transition placeholder:text-ink/35 focus:border-coral focus:ring-2 focus:ring-coral/20";

/**
 * A setting about the people you add, not about you — which is why it sits apart
 * from your own details rather than among them.
 */
export function DefaultUniversityControl({
  initialValue,
  accountEmail = "",
}: {
  initialValue: string;
  /** Used only to recognise the school, never sent anywhere. */
  accountEmail?: string;
}) {
  const [value, setValue] = useState(initialValue);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  // The field keeps its own text, so accepting a suggestion has to remount it.
  const [seed, setSeed] = useState(0);

  // Offered while the field is blank, and gone the moment it is not.
  const suggestion = useUniversitySuggestion(accountEmail, value);

  async function save() {
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/settings/own-card", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ defaultUniversity: value }),
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
      <label className="block text-xs font-semibold text-ink-muted">
        <span className="sr-only">University</span>
        <CollegeInput
          key={seed}
          name="defaultUniversity"
          defaultValue={value}
          className={inputClassName}
          onValueChange={setValue}
        />
      </label>

      {suggestion ? (
        <div className="mt-2.5 flex flex-wrap items-center gap-2.5">
          <p className="text-xs text-ink-muted">
            {suggestion.note}:{" "}
            <span className="font-semibold text-ink">{suggestion.name}</span>
          </p>
          <button
            type="button"
            onClick={() => {
              setValue(suggestion.name);
              setSeed((count) => count + 1);
            }}
            className="rounded-xl bg-ink/[0.06] px-3 py-1.5 text-xs font-semibold text-ink transition-colors hover:bg-ink/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral"
          >
            Use it
          </button>
        </div>
      ) : null}

      {error ? <p className="mt-3 text-sm text-coral-strong">{error}</p> : null}

      <button
        type="button"
        onClick={() => void save()}
        disabled={saving}
        className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-ink px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-[#28332e] disabled:cursor-wait disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral focus-visible:ring-offset-2"
      >
        {saving ? (
          <SpinnerGap size={15} className="animate-spin" aria-hidden="true" />
        ) : saved ? (
          <Check size={15} weight="bold" aria-hidden="true" />
        ) : null}
        {saved ? "Saved" : "Save default"}
      </button>
    </div>
  );
}
