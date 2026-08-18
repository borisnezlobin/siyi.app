"use client";

import { Check, SpinnerGap, Star } from "@phosphor-icons/react";
import { useState } from "react";
import { brand } from "@/config/brand";
import { getApiResponseError } from "@/lib/http";

const inputClassName =
  "mt-1.5 w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm text-ink outline-none transition placeholder:text-ink/35 focus:border-coral focus:ring-2 focus:ring-coral/20";

const MIN_BODY = 20;

/**
 * Writing a review for the public page.
 *
 * Nothing here is conditioned on the rating: the same form, the same wording,
 * and the same path whether someone picks one star or five. Offering anything
 * in exchange for a *positive* review is the specific act the FTC's Consumer
 * Reviews Rule prohibits, and a form that nudges toward five stars is the first
 * step to doing it by accident.
 */
export function ReviewControl({
  initialRating = 0,
  initialBody = "",
  initialAuthorLabel = "",
  alreadyPublished = false,
}: {
  initialRating?: number;
  initialBody?: string;
  initialAuthorLabel?: string;
  alreadyPublished?: boolean;
}) {
  const [rating, setRating] = useState(initialRating);
  const [body, setBody] = useState(initialBody);
  const [authorLabel, setAuthorLabel] = useState(initialAuthorLabel);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const tooShort = body.trim().length < MIN_BODY;

  async function save() {
    if (rating === 0) {
      setError("Pick a rating first.");
      return;
    }
    if (tooShort) {
      setError(`A review needs at least ${MIN_BODY} characters.`);
      return;
    }
    if (!authorLabel.trim()) {
      setError("Add a name to sign it with.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rating,
          body: body.trim(),
          authorLabel: authorLabel.trim(),
        }),
      });

      if (!response.ok) {
        setError(
          await getApiResponseError(response, "That review could not be saved."),
        );
        return;
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-[1.5rem] bg-white p-6 shadow-card">
      <h2 className="font-display text-2xl tracking-[-0.02em]">
        Write a review
      </h2>
      <p className="mt-2 text-sm leading-7 text-ink-muted">
        Reviews appear on the public {brand.name} page, which our team runs and
        says so. Say what you actually think — we publish critical ones too, and
        nothing here depends on the rating you pick.
      </p>

      <div className="mt-5">
        <span className="text-sm font-semibold">Rating</span>
        <div className="mt-2 flex gap-1">
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setRating(value)}
              aria-label={`${value} out of 5`}
              aria-pressed={rating === value}
              className="rounded-lg p-1 text-coral transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral"
            >
              <Star
                size={26}
                weight={value <= rating ? "fill" : "regular"}
                className={value <= rating ? undefined : "text-ink-muted/40"}
              />
            </button>
          ))}
        </div>
      </div>

      <label className="mt-5 block">
        <span className="text-sm font-semibold">Your review</span>
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          rows={5}
          maxLength={1200}
          placeholder={`What ${brand.shortName} is like to use, and who you would or would not recommend it to.`}
          className={inputClassName}
        />
      </label>

      <label className="mt-4 block">
        <span className="text-sm font-semibold">Sign it as</span>
        <input
          value={authorLabel}
          onChange={(event) => setAuthorLabel(event.target.value)}
          maxLength={60}
          placeholder="Maya, second year"
          className={inputClassName}
        />
        <span className="mt-1.5 block text-xs text-ink-muted">
          This is what readers see. Your account name and email are never shown.
        </span>
      </label>

      {error ? (
        <p className="mt-4 text-sm font-semibold text-coral-strong">{error}</p>
      ) : null}

      <div className="mt-5 flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-coral px-6 text-sm font-bold text-white shadow-float transition-colors hover:bg-coral-strong disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral focus-visible:ring-offset-2"
        >
          {saving ? (
            <SpinnerGap size={17} weight="bold" className="animate-spin" />
          ) : null}
          {alreadyPublished ? "Update my review" : "Submit review"}
        </button>
        {saved ? (
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-sage-strong">
            <Check size={16} weight="bold" />
            Saved — we read it before it goes up
          </span>
        ) : null}
      </div>

      {alreadyPublished ? (
        <p className="mt-4 text-xs leading-6 text-ink-muted">
          Editing a published review takes it down until we have read the new
          version. A review that could change after publication would not be
          worth much to whoever reads it next.
        </p>
      ) : null}
    </section>
  );
}
