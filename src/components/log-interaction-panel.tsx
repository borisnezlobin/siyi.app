"use client";

import { Check, SpinnerGap } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  emptyInteractionDraft,
  InteractionComposer,
  type InteractionDraft,
} from "@/components/interaction-composer";
import { logInteraction } from "@/lib/capture-client";
import type { PickablePerson } from "@/lib/person-search";

/**
 * The home screen's fast path: tap the faces of whoever you saw and save. The
 * title, date and note underneath are all optional, because most days the only
 * thing worth recording is who you were with.
 */
export function LogInteractionPanel({ people }: { people: PickablePerson[] }) {
  const router = useRouter();
  const [draft, setDraft] = useState<InteractionDraft>(emptyInteractionDraft());
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const chosenCount = draft.personIds.length;

  async function save() {
    setSaving(true);
    setError("");
    const failure = await logInteraction(draft);
    setSaving(false);

    if (failure) {
      setError(failure);
      return;
    }

    setSaved(true);
    setDraft(emptyInteractionDraft());
    router.refresh();
    window.setTimeout(() => setSaved(false), 2200);
  }

  return (
    <section className="mt-9" aria-labelledby="log-interaction-heading">
      <h2 id="log-interaction-heading" className="text-base font-bold">
        Who did you see?
      </h2>
      <p className="mt-1 text-xs text-ink-muted">
        Tap a face. Everything after that is optional.
      </p>

      <div className="mt-4">
        <InteractionComposer
          people={people}
          draft={draft}
          onDraftChange={setDraft}
        />
      </div>

      {error ? (
        <p
          role="alert"
          className="mt-4 rounded-xl bg-[#fbe5e0] px-3 py-2.5 text-xs font-semibold text-coral-strong"
        >
          {error}
        </p>
      ) : null}

      {chosenCount ? (
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="mt-5 flex min-h-13 w-full items-center justify-center gap-2 rounded-2xl bg-ink px-5 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-[#28332e] disabled:cursor-wait focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral focus-visible:ring-offset-2 sm:w-auto sm:px-8"
        >
          {saving ? (
            <>
              <SpinnerGap size={17} className="animate-spin" aria-hidden="true" />
              Saving…
            </>
          ) : (
            `Log time with ${chosenCount} ${chosenCount === 1 ? "person" : "people"}`
          )}
        </button>
      ) : null}

      {saved ? (
        <p
          role="status"
          className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-sage-strong"
        >
          <Check size={15} weight="bold" aria-hidden="true" />
          Logged.
        </p>
      ) : null}
    </section>
  );
}
