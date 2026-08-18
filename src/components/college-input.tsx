"use client";

import { X } from "@phosphor-icons/react";
import clsx from "clsx";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { College } from "@/lib/colleges";

/**
 * The college table is over a megabyte, and this field appears on Settings,
 * Add someone, Edit and Your card — four of the heaviest routes in the app,
 * one of them a tab in the bottom bar. Loading it with the page put that
 * megabyte on the main thread of a tap that may never touch this field.
 *
 * It is fetched the first time the field is focused instead. Until it lands the
 * input behaves exactly as the comment below promises: a plain text box that
 * accepts anything. Only the suggestions wait.
 */
type CollegeSearch = {
  searchColleges: (query: string, limit?: number) => College[];
  normalizeCollegeText: (value: string) => string;
};

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
  const inputRef = useRef<HTMLInputElement>(null);

  const [colleges, setColleges] = useState<CollegeSearch | null>(null);

  useEffect(() => {
    if (!open || colleges) return;
    let stillMounted = true;
    void import("@/lib/colleges").then(({ searchColleges, normalizeCollegeText }) => {
      if (stillMounted) setColleges({ searchColleges, normalizeCollegeText });
    });
    return () => {
      stillMounted = false;
    };
  }, [colleges, open]);

  const suggestions = useMemo(() => {
    if (!open || !colleges) return [];
    const matches = colleges.searchColleges(value, 6);
    if (
      matches.length === 1 &&
      colleges.normalizeCollegeText(matches[0].name) ===
        colleges.normalizeCollegeText(value)
    ) {
      return [];
    }
    return matches;
  }, [colleges, open, value]);

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
        ref={inputRef}
        name={name}
        value={value}
        maxLength={120}
        autoComplete="off"
        role="combobox"
        aria-expanded={suggestions.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        // Room on the right for the clear button, so a long university name
        // does not run underneath it.
        className={clsx(className, value && "pr-10")}
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
      {/* A default university arrives already filled in, and clearing a field
          you did not type in should not mean selecting it first. */}
      {value ? (
        <button
          type="button"
          onClick={() => {
            update("");
            setOpen(false);
            inputRef.current?.focus();
          }}
          aria-label="Clear university"
          className="absolute right-2 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-full text-ink-muted transition-colors hover:bg-mist hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral"
        >
          <X size={14} aria-hidden="true" />
        </button>
      ) : null}
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
