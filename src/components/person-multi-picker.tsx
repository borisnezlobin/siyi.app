"use client";

import { Check, MagnifyingGlass } from "@phosphor-icons/react";
import clsx from "clsx";
import { useId, useMemo, useState } from "react";
import { Avatar } from "@/components/avatar";
import { rankPeopleForPicker, type PickablePerson } from "@/lib/person-search";

const displayNameOf = (person: PickablePerson) =>
  person.preferredName ?? person.fullName;

/**
 * Choosing several people: a grid of faces you tap, with search for anyone who
 * does not fit on screen.
 *
 * Lifted out of the interaction composer when reminders learned to be about
 * more than one person. Copying it would have meant two grids that drift —
 * this is the same control, so "who was there" and "who is this about" behave
 * identically, including the part where someone already chosen never hides
 * behind a search.
 */
export function PersonMultiPicker({
  people,
  value,
  onChange,
  facesShown = 12,
  searchLabel = "Search people",
}: {
  people: PickablePerson[];
  value: string[];
  onChange: (personIds: string[]) => void;
  /** Kept small on the phone sheet, roomier on the home screen. */
  facesShown?: number;
  searchLabel?: string;
}) {
  const fieldId = useId();
  const [query, setQuery] = useState("");

  const faces = useMemo(() => {
    const ranked = rankPeopleForPicker(people, query, facesShown);
    // Someone already chosen never disappears behind a search, or tapping them
    // again to undo would mean clearing the box first.
    const chosen = people.filter(
      (person) =>
        value.includes(person.id) &&
        !ranked.some((match) => match.id === person.id),
    );
    return [...chosen, ...ranked];
  }, [people, query, facesShown, value]);

  function toggle(personId: string) {
    onChange(
      value.includes(personId)
        ? value.filter((id) => id !== personId)
        : [...value, personId],
    );
  }

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
          aria-label={searchLabel}
          className="h-12 w-full rounded-2xl border border-black/10 bg-white pl-10 pr-4 text-sm text-ink outline-none transition placeholder:text-ink/35 focus:border-coral focus:ring-2 focus:ring-coral/20"
        />
      </div>

      {faces.length ? (
        <ul className="mt-4 grid grid-cols-4 gap-x-2 gap-y-4 sm:grid-cols-5">
          {faces.map((person) => {
            const selected = value.includes(person.id);
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
    </div>
  );
}
