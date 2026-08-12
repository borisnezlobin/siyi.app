"use client";

import clsx from "clsx";
import { useId } from "react";
import { PersonMultiPicker } from "@/components/person-multi-picker";
import { DateField } from "@/components/date-field";
import { todayDateInputValue } from "@/lib/date-input";
import { interactionTitleSuggestions } from "@/lib/interaction-title";
import { type PickablePerson } from "@/lib/person-search";

export type InteractionDraft = {
  personIds: string[];
  title: string;
  occurredOn: string;
  note: string;
};

export function emptyInteractionDraft(
  personIds: string[] = [],
): InteractionDraft {
  return {
    personIds,
    title: "",
    occurredOn: todayDateInputValue(),
    note: "",
  };
}

type InteractionComposerProps = {
  people: PickablePerson[];
  draft: InteractionDraft;
  onDraftChange: (draft: InteractionDraft) => void;
  /** Kept small on the phone sheet, roomier on the home screen. */
  facesShown?: number;
};

/**
 * Selecting people is the fast path — a grid of faces you tap, with search for
 * anyone who does not fit on screen. Everything after it is optional, so it
 * stays out of the way until at least one person is chosen.
 */
export function InteractionComposer({
  people,
  draft,
  onDraftChange,
  facesShown = 12,
}: InteractionComposerProps) {
  const fieldId = useId();
  const today = todayDateInputValue();

  const chosenCount = draft.personIds.length;

  return (
    <div>
      <PersonMultiPicker
        people={people}
        value={draft.personIds}
        onChange={(personIds) => onDraftChange({ ...draft, personIds })}
        facesShown={facesShown}
        searchLabel="Search people"
      />

      {chosenCount ? (
        <div className="mt-6 border-t border-ink/[0.08] pt-5">
          <label
            htmlFor={`${fieldId}-title`}
            className="text-xs font-semibold text-ink-muted"
          >
            What was it? <span className="font-normal">(optional)</span>
          </label>
          <input
            id={`${fieldId}-title`}
            type="text"
            value={draft.title}
            maxLength={40}
            onChange={(event) =>
              onDraftChange({ ...draft, title: event.target.value })
            }
            placeholder="Coffee, studio night, ran into them…"
            className="mt-1.5 h-12 w-full rounded-2xl border border-black/10 bg-white px-4 text-sm text-ink outline-none transition placeholder:text-ink/35 focus:border-coral focus:ring-2 focus:ring-coral/20"
          />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {interactionTitleSuggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => onDraftChange({ ...draft, title: suggestion })}
                className={clsx(
                  "rounded-full px-3 py-1.5 text-[11px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral",
                  draft.title === suggestion
                    ? "bg-ink text-white"
                    : "bg-porcelain text-ink-muted hover:text-ink",
                )}
              >
                {suggestion}
              </button>
            ))}
          </div>

          <DateField
            className="mt-5"
            inputClassName="mt-1.5 h-12 w-full rounded-2xl border border-black/10 bg-white px-4 text-sm text-ink outline-none transition focus:border-coral focus:ring-2 focus:ring-coral/20"
            label="When?"
            max={today}
            onChange={(next) => onDraftChange({ ...draft, occurredOn: next })}
            value={draft.occurredOn}
          />

          <label
            htmlFor={`${fieldId}-note`}
            className="mt-5 block text-xs font-semibold text-ink-muted"
          >
            Anything to remember? <span className="font-normal">(optional)</span>
          </label>
          <textarea
            id={`${fieldId}-note`}
            value={draft.note}
            rows={2}
            maxLength={1000}
            onChange={(event) =>
              onDraftChange({ ...draft, note: event.target.value })
            }
            placeholder="A line is plenty."
            className="mt-1.5 w-full resize-none rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm text-ink outline-none transition placeholder:text-ink/35 focus:border-coral focus:ring-2 focus:ring-coral/20"
          />
        </div>
      ) : null}
    </div>
  );
}
