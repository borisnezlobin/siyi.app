"use client";

import { useId, useMemo, useState } from "react";
import { normalizeCollegeText, searchColleges } from "@/lib/colleges";

/**
 * A university field that suggests schools as you type, so "cmu" or "uc berkeley"
 * lands on the full name. It stays a plain text input underneath: anything can be
 * typed and saved, whether or not the list has heard of it.
 */
export function CollegeInput({
  name = "university",
  defaultValue = "",
  className,
  onValueChange,
}: {
  name?: string;
  defaultValue?: string;
  className?: string;
  /** For callers holding the value in state rather than reading the form. */
  onValueChange?: (value: string) => void;
}) {
  const [value, setValue] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const listId = useId();

  const suggestions = useMemo(() => {
    if (!open) return [];
    const matches = searchColleges(value, 6);
    if (
      matches.length === 1 &&
      normalizeCollegeText(matches[0].name) === normalizeCollegeText(value)
    ) {
      return [];
    }
    return matches;
  }, [open, value]);

  function update(next: string) {
    setValue(next);
    onValueChange?.(next);
  }

  function choose(collegeName: string) {
    update(collegeName);
    setOpen(false);
    setActiveIndex(-1);
  }

  return (
    <div className="relative">
      <input
        name={name}
        value={value}
        maxLength={120}
        autoComplete="off"
        role="combobox"
        aria-expanded={suggestions.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        className={className}
        placeholder="Start typing, or an acronym like CMU"
        onChange={(event) => {
          update(event.target.value);
          setOpen(true);
          setActiveIndex(-1);
        }}
        onFocus={() => setOpen(true)}
        // A click on a suggestion fires after blur, so the list has to outlive it.
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
        onKeyDown={(event) => {
          if (!suggestions.length) return;
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setActiveIndex((index) => (index + 1) % suggestions.length);
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setActiveIndex((index) => (index <= 0 ? suggestions.length - 1 : index - 1));
          } else if (event.key === "Enter" && activeIndex >= 0) {
            event.preventDefault();
            choose(suggestions[activeIndex].name);
          } else if (event.key === "Escape") {
            setOpen(false);
          }
        }}
      />
      {suggestions.length > 0 ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl bg-white shadow-lg ring-1 ring-black/10"
        >
          {suggestions.map((college, index) => (
            <li key={college.name}>
              <button
                type="button"
                role="option"
                aria-selected={index === activeIndex}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(college.name)}
                className={
                  index === activeIndex
                    ? "block w-full bg-mist/60 px-4 py-2.5 text-left"
                    : "block w-full px-4 py-2.5 text-left hover:bg-mist/40"
                }
              >
                <span className="block text-sm text-ink">{college.name}</span>
                {college.place ? (
                  <span className="block text-xs text-ink-muted">{college.place}</span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
