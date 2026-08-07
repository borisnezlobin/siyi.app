"use client";

import { Check, SpinnerGap } from "@phosphor-icons/react";
import { useState } from "react";
import { CollegeInput } from "@/components/college-input";
import { getApiResponseError } from "@/lib/http";

const inputClassName =
  "mt-1.5 h-12 w-full rounded-2xl border border-black/10 bg-white px-4 text-sm text-ink outline-none transition placeholder:text-ink/35 focus:border-coral focus:ring-2 focus:ring-coral/20";

/**
 * A setting about the people you add, not about you — which is why it sits apart
 * from your own details rather than among them.
 */
export function DefaultUniversityControl({
  initialValue,
}: {
  initialValue: string;
}) {
  const [value, setValue] = useState(initialValue);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

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
        <span className="sr-only">Default university</span>
        <CollegeInput
          name="defaultUniversity"
          defaultValue={value}
          className={inputClassName}
          onValueChange={setValue}
        />
      </label>

      {error ? <p className="mt-3 text-sm text-coral-strong">{error}</p> : null}

      <button
        type="button"
        onClick={() => void save()}
        disabled={saving}
        className="mt-4 inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-porcelain px-5 text-sm font-semibold text-ink transition-colors hover:bg-mist disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral"
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
