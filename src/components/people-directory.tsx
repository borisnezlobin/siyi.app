"use client";

import {
  CaretDown,
  Funnel,
  MagnifyingGlass,
  Plus,
  X,
} from "@phosphor-icons/react";
import clsx from "clsx";
import { differenceInCalendarDays } from "date-fns";
import Link from "next/link";
import { useMemo, useState } from "react";
import { PersonRow } from "@/components/person-row";
import { contactDraftsOf } from "@/lib/contact-methods";
import { getContactReminderState } from "@/lib/reminders";
import type { Person, RelationshipStrength } from "@/lib/types";

type SortOption = "recently-contacted" | "least-recent" | "name" | "newest";
type FilterOption = "all" | "overdue" | "recent";

export function PeopleDirectory({
  people,
  initialFilter = "all",
}: {
  people: Person[];
  initialFilter?: FilterOption;
}) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterOption>(initialFilter);
  const [strength, setStrength] = useState<RelationshipStrength | "all">("all");
  const [tag, setTag] = useState("all");
  const [sort, setSort] = useState<SortOption>("recently-contacted");
  const [filtersOpen, setFiltersOpen] = useState(initialFilter !== "all");

  const allTags = useMemo(
    () =>
      Array.from(
        new Set(people.flatMap((person) => person.tags?.map(({ name }) => name) ?? [])),
      ).sort(),
    [people],
  );

  const filteredPeople = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    const now = new Date();

    return people
      .filter((person) => {
        const searchableText = [
          person.fullName,
          person.preferredName,
          // Every number, address and handle, not only the primary — searching
          // for the old number of someone who changed it still finds them.
          ...contactDraftsOf(person).flatMap((method) => [
            method.value,
            method.label,
          ]),
          person.email,
          person.generalNotes,
          person.major,
          person.dormOrResidence,
          ...(person.tags?.map(({ name }) => name) ?? []),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        if (normalizedSearch && !searchableText.includes(normalizedSearch)) {
          return false;
        }
        if (strength !== "all" && person.relationshipStrength !== strength) {
          return false;
        }
        if (tag !== "all" && !person.tags?.some(({ name }) => name === tag)) {
          return false;
        }
        if (filter === "overdue" && !getContactReminderState(person, now)?.isOverdue) {
          return false;
        }
        if (
          filter === "recent" &&
          differenceInCalendarDays(now, new Date(person.createdAt)) > 7
        ) {
          return false;
        }
        return person.status !== "archived";
      })
      .sort((firstPerson, secondPerson) => {
        if (sort === "name") {
          return firstPerson.fullName.localeCompare(secondPerson.fullName);
        }
        if (sort === "newest") {
          return (
            new Date(secondPerson.createdAt).getTime() -
            new Date(firstPerson.createdAt).getTime()
          );
        }

        const firstContact = new Date(
          firstPerson.lastInteractionAt ?? firstPerson.firstMetAt,
        ).getTime();
        const secondContact = new Date(
          secondPerson.lastInteractionAt ?? secondPerson.firstMetAt,
        ).getTime();
        return sort === "least-recent"
          ? firstContact - secondContact
          : secondContact - firstContact;
      });
  }, [filter, people, search, sort, strength, tag]);

  const activeFilterCount =
    Number(filter !== "all") + Number(strength !== "all") + Number(tag !== "all");

  function clearFilters() {
    setFilter("all");
    setStrength("all");
    setTag("all");
  }

  return (
    <div>
      <div className="mt-7 flex gap-2">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">Search people</span>
          <MagnifyingGlass
            size={19}
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-muted"
            aria-hidden="true"
          />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Name, tag, note, major…"
            className="h-12 w-full rounded-2xl border border-black/10 bg-white pl-11 pr-4 text-sm outline-none transition placeholder:text-ink/35 focus:border-coral focus:ring-2 focus:ring-coral/20"
          />
        </label>
        <button
          type="button"
          onClick={() => setFiltersOpen((open) => !open)}
          className={clsx(
            "relative grid size-12 shrink-0 place-items-center rounded-2xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral",
            filtersOpen || activeFilterCount
              ? "bg-ink text-white"
              : "bg-white text-ink-muted hover:text-ink",
          )}
          aria-expanded={filtersOpen}
          aria-controls="people-filters"
          aria-label="Show filters"
        >
          <Funnel size={19} weight={activeFilterCount ? "fill" : "regular"} aria-hidden="true" />
          {activeFilterCount ? (
            <span className="absolute -right-1 -top-1 grid size-5 place-items-center rounded-full bg-coral text-[9px] font-bold text-white ring-2 ring-porcelain">
              {activeFilterCount}
            </span>
          ) : null}
        </button>
      </div>

      {filtersOpen ? (
        <div
          id="people-filters"
          className="mt-3 border-t border-ink/[0.08] pt-4"
        >
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm font-bold">Narrow the list</p>
            {activeFilterCount ? (
              <button
                type="button"
                onClick={clearFilters}
                className="flex items-center gap-1 text-xs font-semibold text-coral-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral"
              >
                <X size={13} aria-hidden="true" />
                Clear
              </button>
            ) : null}
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <label className="text-xs font-semibold text-ink-muted">
              Status
              <span className="relative mt-1.5 block">
                <select
                  value={filter}
                  onChange={(event) => setFilter(event.target.value as FilterOption)}
                  className="h-11 w-full appearance-none rounded-xl border border-black/10 bg-white px-3 pr-9 text-sm text-ink outline-none focus:border-coral focus:ring-2 focus:ring-coral/20"
                >
                  <option value="all">Everyone</option>
                  <option value="overdue">Overdue</option>
                  <option value="recent">Added recently</option>
                </select>
                <CaretDown
                  size={14}
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted"
                  aria-hidden="true"
                />
              </span>
            </label>
            <label className="text-xs font-semibold text-ink-muted">
              Relationship
              <span className="relative mt-1.5 block">
                <select
                  value={strength}
                  onChange={(event) =>
                    setStrength(
                      event.target.value === "all"
                        ? "all"
                        : (Number(event.target.value) as RelationshipStrength),
                    )
                  }
                  className="h-11 w-full appearance-none rounded-xl border border-black/10 bg-white px-3 pr-9 text-sm text-ink outline-none focus:border-coral focus:ring-2 focus:ring-coral/20"
                >
                  <option value="all">Any pace</option>
                  <option value="4">Very close</option>
                  <option value="3">Close</option>
                  <option value="2">Getting to know</option>
                  <option value="1">Acquaintance</option>
                </select>
                <CaretDown
                  size={14}
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted"
                  aria-hidden="true"
                />
              </span>
            </label>
            <label className="text-xs font-semibold text-ink-muted">
              Tag
              <span className="relative mt-1.5 block">
                <select
                  value={tag}
                  onChange={(event) => setTag(event.target.value)}
                  className="h-11 w-full appearance-none rounded-xl border border-black/10 bg-white px-3 pr-9 text-sm text-ink outline-none focus:border-coral focus:ring-2 focus:ring-coral/20"
                >
                  <option value="all">Any tag</option>
                  {allTags.map((tagName) => (
                    <option key={tagName} value={tagName}>
                      {tagName}
                    </option>
                  ))}
                </select>
                <CaretDown
                  size={14}
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted"
                  aria-hidden="true"
                />
              </span>
            </label>
          </div>
        </div>
      ) : null}

      <div className="mt-5 flex items-center justify-between gap-3">
        <p className="text-xs text-ink-muted">
          {filteredPeople.length} {filteredPeople.length === 1 ? "person" : "people"}
        </p>
        <label className="flex items-center gap-2 text-xs font-semibold text-ink-muted">
          <span className="sr-only">Sort people</span>
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value as SortOption)}
            className="rounded-xl border border-black/10 bg-white px-3 py-2 text-xs text-ink outline-none focus:border-coral focus:ring-2 focus:ring-coral/20"
          >
            <option value="recently-contacted">Recently contacted</option>
            <option value="least-recent">Least recently contacted</option>
            <option value="name">Name</option>
            <option value="newest">Newest</option>
          </select>
        </label>
      </div>

      <div className="mt-3 divide-y divide-ink/[0.07]">
        {filteredPeople.length ? (
          filteredPeople.map((person) => (
            <PersonRow
              key={person.id}
              person={person}
              showOverdue={filter === "overdue"}
            />
          ))
        ) : (
          <div className="px-6 py-14 text-center">
            <p className="font-display text-2xl">No one matches that yet.</p>
            <p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-ink-muted">
              Try a different filter, or add someone while the details are fresh.
            </p>
            <Link
              href="/people/new"
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-coral px-4 py-3 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral focus-visible:ring-offset-2"
            >
              <Plus size={17} weight="bold" aria-hidden="true" />
              Add someone
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
