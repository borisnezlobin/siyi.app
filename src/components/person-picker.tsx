"use client";

import { MagnifyingGlass, X } from "@phosphor-icons/react";
import clsx from "clsx";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Avatar } from "@/components/avatar";
import { rankPeopleForPicker, type PickablePerson } from "@/lib/person-search";

type PersonPickerProps = {
  people: PickablePerson[];
  value: string;
  onChange: (personId: string) => void;
  label?: string;
  placeholder?: string;
};

const displayNameOf = (person: PickablePerson) =>
  person.preferredName ?? person.fullName;

export function PersonPicker({
  people,
  value,
  onChange,
  label = "Person",
  placeholder = "Start typing a name",
}: PersonPickerProps) {
  const inputId = useId();
  const listId = `${inputId}-list`;
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = people.find((person) => person.id === value) ?? null;
  const matches = useMemo(
    () => rankPeopleForPicker(people, query),
    [people, query],
  );

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  function choose(person: PickablePerson) {
    onChange(person.id);
    setQuery("");
    setOpen(false);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActiveIndex((current) => {
        if (matches.length === 0) return 0;
        return (current + step + matches.length) % matches.length;
      });
      return;
    }
    if (event.key === "Enter" && open && matches[activeIndex]) {
      event.preventDefault();
      choose(matches[activeIndex]);
      return;
    }
    if (event.key === "Escape" && open) {
      event.preventDefault();
      setOpen(false);
    }
  }

  if (selected) {
    return (
      <div className="mt-6">
        <p className="text-xs font-semibold text-ink-muted">{label}</p>
        <div className="mt-1.5 flex items-center gap-3 rounded-2xl bg-porcelain px-3 py-2.5">
          <Avatar
            name={selected.fullName}
            imageUrl={selected.profilePhotoUrl ?? null}
            size="sm"
          />
          <span className="min-w-0 flex-1 truncate text-sm font-semibold">
            {displayNameOf(selected)}
          </span>
          <button
            type="button"
            onClick={() => {
              onChange("");
              setQuery("");
            }}
            className="grid size-8 shrink-0 place-items-center rounded-full text-ink-muted transition-colors hover:bg-mist hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral"
            aria-label={`Choose someone other than ${displayNameOf(selected)}`}
          >
            <X size={15} aria-hidden="true" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-6" ref={containerRef}>
      <label htmlFor={inputId} className="text-xs font-semibold text-ink-muted">
        {label}
      </label>
      <div className="relative mt-1.5">
        <MagnifyingGlass
          size={15}
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-muted"
          aria-hidden="true"
        />
        <input
          id={inputId}
          type="text"
          role="combobox"
          autoComplete="off"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={
            open && matches[activeIndex]
              ? `${listId}-${matches[activeIndex].id}`
              : undefined
          }
          value={query}
          placeholder={placeholder}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          className="h-12 w-full rounded-2xl border border-black/10 bg-white pl-10 pr-4 text-sm text-ink outline-none transition focus:border-coral focus:ring-2 focus:ring-coral/20"
        />
      </div>

      {open ? (
        <ul
          id={listId}
          role="listbox"
          className="mt-2 max-h-56 overflow-y-auto rounded-2xl bg-white p-1 shadow-card ring-1 ring-black/[0.05]"
        >
          {matches.length ? (
            matches.map((person, index) => (
              <li key={person.id} id={`${listId}-${person.id}`} role="option" aria-selected={index === activeIndex}>
                <button
                  type="button"
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => choose(person)}
                  className={clsx(
                    "flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors",
                    index === activeIndex ? "bg-sage" : "hover:bg-porcelain",
                  )}
                >
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                    {displayNameOf(person)}
                  </span>
                  {person.preferredName &&
                  person.preferredName !== person.fullName ? (
                    <span className="shrink-0 text-[11px] text-ink-muted">
                      {person.fullName}
                    </span>
                  ) : null}
                </button>
              </li>
            ))
          ) : (
            <li className="px-3 py-3 text-xs text-ink-muted">
              Nobody by that name yet.
            </li>
          )}
        </ul>
      ) : null}
    </div>
  );
}
