"use client";

import { Check, MagnifyingGlass } from "@phosphor-icons/react";
import clsx from "clsx";
import { useId, useMemo, useState } from "react";
import { Avatar } from "@/components/avatar";
import { DateField } from "@/components/date-field";
import { todayDateInputValue } from "@/lib/date-input";
import { interactionTitleSuggestions } from "@/lib/interaction-title";
import { rankPeopleForPicker, type PickablePerson } from "@/lib/person-search";

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

const displayNameOf = (person: PickablePerson) =>
  person.preferredName ?? person.fullName;

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
  const [query, setQuery] = useState("");
  const today = todayDateInputValue();

  const faces = useMemo(() => {
    const ranked = rankPeopleForPicker(people, query, facesShown);
    // Someone already chosen never disappears behind a search, or tapping them
    // again to undo would mean clearing the box first.
    const chosen = people.filter(
      (person) =>
        draft.personIds.includes(person.id) &&
        !ranked.some((match) => match.id === person.id),
    );
    return [...chosen, ...ranked];
  }, [people, query, facesShown, draft.personIds]);

  function toggle(personId: string) {
    const personIds = draft.personIds.includes(personId)
      ? draft.personIds.filter((id) => id !== personId)
      : [...draft.personIds, personId];
    onDraftChange({ ...draft, personIds });
  }

  const chosenCount = draft.personIds.length;

  return (
    <div>
      <div className="relative">
        <MagnifyingGlass
          size={15}
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-muted"
          aria-hidden="true"
        />
        <input
          id={`${fieldId}-search`}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search your people"
          aria-label="Search people"
          className="h-12 w-full rounded-2xl border border-black/10 bg-white pl-10 pr-4 text-sm text-ink outline-none transition placeholder:text-ink/35 focus:border-coral focus:ring-2 focus:ring-coral/20"
        />
      </div>

      {faces.length ? (
        <ul className="mt-4 grid grid-cols-4 gap-x-2 gap-y-4 sm:grid-cols-5">
          {faces.map((person) => {
            const selected = draft.personIds.includes(person.id);
            return (
              <li key={person.id}>
                <button
                  type="button"
                  onClick={() => toggle(person.id)}
                  aria-pressed={selected}
                  className="flex w-full flex-col items-center gap-1.5 rounded-2xl py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral"
                >
                  <span className="relative">
                    <Avatar
                      name={person.fullName}
                      imageUrl={person.profilePhotoUrl ?? null}
                      size="md"
                      className={clsx(
                        "transition-opacity",
                        selected ? "opacity-100" : "opacity-90",
                      )}
                    />
                    {selected ? (
                      <span className="absolute -bottom-0.5 -right-0.5 grid size-5 place-items-center rounded-full bg-ink text-white ring-2 ring-white">
                        <Check size={11} weight="bold" aria-hidden="true" />
                      </span>
                    ) : null}
                  </span>
                  <span
                    className={clsx(
                      "w-full truncate text-center text-[11px] leading-4",
                      selected ? "font-semibold text-ink" : "text-ink-muted",
                    )}
                  >
                    {displayNameOf(person)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-4 text-xs text-ink-muted">Nobody by that name yet.</p>
      )}

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
