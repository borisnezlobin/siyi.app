"use client";

import { Check, SpinnerGap } from "@phosphor-icons/react";
import { useMemo, useState } from "react";
import { CollegeInput } from "@/components/college-input";
import { DateField } from "@/components/date-field";
import { getApiResponseError } from "@/lib/http";
import {
  ownCardFieldKinds,
  ownCardFields,
  ownCardLabels,
  ownCardPlaceholders,
  ownCardShareState,
  ownCardShareStateLabels,
  type OwnCard,
  type OwnCardField,
} from "@/lib/own-card";
import {
  suggestUniversityFromEmail,
  universitySuggestionNote,
} from "@/lib/university-suggestion";

const inputClassName =
  "mt-1.5 h-12 w-full rounded-2xl border border-black/10 bg-white px-4 text-sm text-ink outline-none transition placeholder:text-ink/35 focus:border-coral focus:ring-2 focus:ring-coral/20";

const labelClassName = "block text-xs font-semibold text-ink-muted";

/**
 * Your own details, and which of them a stranger gets to see.
 *
 * The chips come first because they are the question the page is really asking.
 * Each has three answers rather than two: a field you have not filled in cannot
 * be shared at all, and it says so rather than offering a switch that would do
 * nothing. The fields themselves are the same ones a person record has, entered
 * the same way — schools autocomplete, dates take any spelling.
 */
export function OwnCardForm({
  initialCard,
  initialPublicFields,
  accountEmail,
}: {
  initialCard: OwnCard;
  initialPublicFields: Record<string, boolean>;
  accountEmail: string;
}) {
  const [card, setCard] = useState<OwnCard>(initialCard);
  const [publicFields, setPublicFields] =
    useState<Record<string, boolean>>(initialPublicFields);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  // The school field keeps its own text, so accepting a suggestion remounts it.
  const [universitySeed, setUniversitySeed] = useState(0);

  const suggestion = useMemo(
    () => suggestUniversityFromEmail(accountEmail, card.university),
    [accountEmail, card.university],
  );

  function edit(field: OwnCardField, value: string) {
    setCard((current) => ({ ...current, [field]: value }));
  }

  async function saveCard() {
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/settings/own-card", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ card }),
      });
      if (!response.ok) {
        throw new Error(await getApiResponseError(response, "That could not be saved."));
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

  async function toggleShared(field: OwnCardField, next: boolean) {
    const updated = { ...publicFields, [field]: next };
    setPublicFields(updated);
    setError("");
    try {
      const response = await fetch("/api/settings/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicFields: updated }),
      });
      if (!response.ok) {
        throw new Error(await getApiResponseError(response, "That could not be saved."));
      }
    } catch (caughtError) {
      setPublicFields(publicFields);
      setError(
        caughtError instanceof Error ? caughtError.message : "That could not be saved.",
      );
    }
  }

  return (
    <div>
      <section>
        <h2 className="text-sm font-bold">What goes on it</h2>
        <p className="mt-1 text-xs leading-5 text-ink-muted">
          Tap one to share it or keep it back. A detail you have not filled in
          yet cannot be shared until it has something in it.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {ownCardFields.map((field) => {
            const state = ownCardShareState(card, publicFields, field);
            const stateLabel = ownCardShareStateLabels[state];
            const unavailable = state === "unavailable";

            return (
              <button
                key={field}
                type="button"
                aria-pressed={state === "shared"}
                aria-disabled={unavailable}
                onClick={() => {
                  if (unavailable) return;
                  void toggleShared(field, state !== "shared");
                }}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral ${
                  state === "shared"
                    ? "bg-ink text-white"
                    : unavailable
                      ? "cursor-not-allowed bg-ink/[0.03] text-ink/35"
                      : "bg-ink/[0.06] text-ink-muted hover:bg-ink/10"
                }`}
              >
                {state === "shared" ? (
                  <Check size={13} weight="bold" aria-hidden="true" />
                ) : null}
                <span className={state === "hidden" ? "line-through" : undefined}>
                  {ownCardLabels[field]}
                </span>
                <span className="sr-only">, {stateLabel}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="mt-8 border-t border-ink/[0.08] pt-7">
        <h2 className="text-sm font-bold">Your details</h2>
        <p className="mt-1 text-xs leading-5 text-ink-muted">
          The same things you would record about anyone else. Fill in what you
          are happy to hand out.
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {ownCardFields.map((field) => {
            const kind = ownCardFieldKinds[field];
            const label = ownCardLabels[field];
            const value = card[field] ?? "";

            if (kind === "university") {
              return (
                <div key={field} className="sm:col-span-2">
                  <label className={labelClassName}>
                    {label}
                    <CollegeInput
                      key={universitySeed}
                      name={field}
                      defaultValue={value}
                      className={inputClassName}
                      onValueChange={(next) => edit(field, next)}
                    />
                  </label>
                  {suggestion ? (
                    <div className="mt-2 flex flex-wrap items-center gap-2.5">
                      <p className="text-xs text-ink-muted">
                        {universitySuggestionNote(suggestion.domain)}:{" "}
                        <span className="font-semibold text-ink">{suggestion.name}</span>
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          edit(field, suggestion.name);
                          setUniversitySeed((count) => count + 1);
                        }}
                        className="rounded-xl bg-ink/[0.06] px-3 py-1.5 text-xs font-semibold text-ink transition-colors hover:bg-ink/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral"
                      >
                        Use it
                      </button>
                    </div>
                  ) : null}
                </div>
              );
            }

            if (kind === "date") {
              return (
                <DateField
                  key={field}
                  className="sm:col-span-2"
                  inputClassName={inputClassName}
                  label={label}
                  onChange={(next) => edit(field, next)}
                  value={value}
                />
              );
            }

            return (
              <label key={field} className={labelClassName}>
                {label}
                <input
                  value={value}
                  maxLength={200}
                  className={inputClassName}
                  placeholder={ownCardPlaceholders[field]}
                  inputMode={
                    kind === "number"
                      ? "numeric"
                      : kind === "email"
                        ? "email"
                        : kind === "phone"
                          ? "tel"
                          : undefined
                  }
                  autoComplete={
                    kind === "email" ? "email" : kind === "phone" ? "tel" : "off"
                  }
                  onChange={(event) => edit(field, event.target.value)}
                />
              </label>
            );
          })}
        </div>

        {error ? <p className="mt-3 text-sm text-coral-strong">{error}</p> : null}

        <button
          type="button"
          onClick={() => void saveCard()}
          disabled={saving}
          className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-ink px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-[#28332e] disabled:cursor-wait disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral focus-visible:ring-offset-2"
        >
          {saving ? (
            <SpinnerGap size={15} className="animate-spin" aria-hidden="true" />
          ) : saved ? (
            <Check size={15} weight="bold" aria-hidden="true" />
          ) : null}
          {saved ? "Saved" : "Save my details"}
        </button>
      </section>
    </div>
  );
}
