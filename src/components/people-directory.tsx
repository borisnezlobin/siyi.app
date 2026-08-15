"use client";

import { ArrowsDownUp, Funnel, MagnifyingGlass, Plus, X } from "@phosphor-icons/react";
import clsx from "clsx";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PersonRow } from "@/components/person-row";
import { personMatchesClassQuery, type PersonClass } from "@/lib/classes";
import { contactDraftsOf } from "@/lib/contact-methods";
import { plainCollegeTerms, type CollegeTermsLookup } from "@/lib/college-terms";
import {
  type MissingDetail,
  isMissingDetail,
  matchesPeopleQuery,
  missingDetailLabels,
  sectionPeopleAlphabetically,
  wasAddedRecently,
} from "@/lib/people-filters";
import { relationshipTierLabels } from "@/lib/relationship-labels";
import { getContactReminderState } from "@/lib/reminders";
import { relationshipStrengths, type Person, type RelationshipStrength } from "@/lib/types";

type SortMode = "name" | "newest" | "recently-contacted" | "least-recently-contacted";
type TimingFilter = "all" | "overdue" | "recent";

const sortLabels: Record<SortMode, string> = {
  name: "Name",
  newest: "Newest",
  "recently-contacted": "Recently contacted",
  "least-recently-contacted": "Least recently contacted",
};

const timingOptions: [TimingFilter, string][] = [
  ["all", "Everyone"],
  ["overdue", "Overdue"],
  ["recent", "Added recently"],
];

const missingDetailOptions: MissingDetail[] = ["birthday", "email", "phone"];

export function PeopleDirectory({
  people,
  initialFilter = "all",
  classesByPerson = {},
}: {
  people: Person[];
  initialFilter?: TimingFilter;
  /** Their classes, so "data 8 denero" finds everyone in it. */
  classesByPerson?: Record<string, PersonClass[]>;
}) {
  const [search, setSearch] = useState("");
  const [timing, setTiming] = useState<TimingFilter>(initialFilter);
  const [strength, setStrength] = useState<RelationshipStrength | null>(null);
  const [tag, setTag] = useState<string | null>(null);
  const [sort, setSort] = useState<SortMode>("name");
  const [missing, setMissing] = useState<MissingDetail[]>([]);
  const [filtersOpen, setFiltersOpen] = useState(initialFilter !== "all");
  // The college table is close to a megabyte, so it is fetched the first time
  // someone searches rather than on page load. Until it lands, a query still
  // matches the school name as written; afterwards "CMU" matches Carnegie Mellon.
  const [collegeTerms, setCollegeTerms] = useState<CollegeTermsLookup>(
    () => plainCollegeTerms,
  );

  useEffect(() => {
    if (!search.trim() || collegeTerms !== plainCollegeTerms) return;
    let stillMounted = true;
    void import("@/lib/colleges").then(({ collegeSearchTerms }) => {
      if (stillMounted) setCollegeTerms(() => collegeSearchTerms);
    });
    return () => {
      stillMounted = false;
    };
  }, [collegeTerms, search]);

  const allTags = useMemo(
    () =>
      Array.from(
        new Set(people.flatMap((person) => person.tags?.map(({ name }) => name) ?? [])),
      ).sort(),
    [people],
  );

  const filteredPeople = useMemo(() => {
    const now = new Date();

    return people
      .filter((person) => {
        if (person.status === "archived") return false;
        // Every number, address and handle, not only the primary — searching
        // for the old number of someone who changed it still finds them.
        const searchable = {
          ...person,
          contactMethods: contactDraftsOf(person),
        };

        if (
          !matchesPeopleQuery(searchable, search, collegeTerms) &&
          !personMatchesClassQuery(classesByPerson[person.id] ?? [], search)
        ) {
          return false;
        }
        if (missing.some((detail) => !isMissingDetail(person, detail))) return false;
        if (strength && person.relationshipStrength !== strength) return false;
        if (tag && !person.tags?.some(({ name }) => name === tag)) return false;
        if (timing === "overdue" && !getContactReminderState(person, now)?.isOverdue) {
          return false;
        }
        if (timing === "recent" && !wasAddedRecently(person.createdAt, now)) {
          return false;
        }
        return true;
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
        return sort === "least-recently-contacted"
          ? firstContact - secondContact
          : secondContact - firstContact;
      });
  }, [classesByPerson, collegeTerms, missing, people, search, sort, strength, tag, timing]);

  const sections = useMemo(
    () => (sort === "name" ? sectionPeopleAlphabetically(filteredPeople) : []),
    [filteredPeople, sort],
  );

  const activeFilterCount =
    Number(timing !== "all") + Number(strength !== null) + Number(tag !== null) + missing.length;

  function clearFilters() {
    setTiming("all");
    setStrength(null);
    setTag(null);
    setMissing([]);
  }

  return (
    <div>
      {/* Stays put while the list runs under it, so searching and filtering do
          not mean scrolling back to the top first. The negative margins let the
          blur reach the page edges rather than stop at the text column. */}
      <div className="sticky top-0 z-20 -mx-4 bg-porcelain/85 px-4 pb-3 pt-7 backdrop-blur sm:-mx-7 sm:px-7 lg:-mx-10 lg:px-10">
        <div className="flex gap-2">
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
              placeholder="Search…"
              className="h-12 w-full rounded-2xl border border-black/10 bg-white pl-11 pr-11 text-sm outline-none transition [&::-webkit-search-cancel-button]:hidden placeholder:text-ink/35 focus:border-coral focus:ring-2 focus:ring-coral/20"
            />
            {search ? (
              <button
                type="button"
                onClick={() => setSearch("")}
                aria-label="Clear search"
                className="absolute right-3 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded-full text-ink-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral"
              >
                <X size={14} weight="bold" aria-hidden="true" />
              </button>
            ) : null}
          </label>
          <button
            type="button"
            onClick={() => setFiltersOpen((open) => !open)}
            className={clsx(
              "relative grid size-12 shrink-0 place-items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral",
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

      </div>
      {filtersOpen ? (
        <div id="people-filters" className="mt-4 space-y-4 border-t border-ink/[0.08] pt-4">
          <FilterGroup label="Reminder pace">
            {relationshipStrengths.map((value) => (
              <FilterChip
                key={value}
                label={relationshipTierLabels[value]}
                onClick={() => setStrength(strength === value ? null : value)}
                selected={strength === value}
              />
            ))}
          </FilterGroup>

          <FilterGroup label="Timing">
            {timingOptions.map(([value, label]) => (
              <FilterChip
                key={value}
                label={label}
                onClick={() => setTiming(value)}
                selected={timing === value}
              />
            ))}
          </FilterGroup>

          <FilterGroup label="Missing details">
            {missingDetailOptions.map((detail) => (
              <FilterChip
                key={detail}
                label={missingDetailLabels[detail]}
                onClick={() =>
                  setMissing((current) =>
                    current.includes(detail)
                      ? current.filter((entry) => entry !== detail)
                      : [...current, detail],
                  )
                }
                selected={missing.includes(detail)}
              />
            ))}
          </FilterGroup>

          {allTags.length ? (
            <FilterGroup label="Tag">
              {allTags.map((tagName) => (
                <FilterChip
                  key={tagName}
                  label={tagName}
                  onClick={() => setTag(tag === tagName ? null : tagName)}
                  selected={tag === tagName}
                />
              ))}
            </FilterGroup>
          ) : null}

          <FilterGroup
            label="Sort"
            icon={<ArrowsDownUp size={15} className="text-ink-muted" aria-hidden="true" />}
          >
            {(Object.keys(sortLabels) as SortMode[]).map((value) => (
              <FilterChip
                key={value}
                label={sortLabels[value]}
                onClick={() => setSort(value)}
                selected={sort === value}
              />
            ))}
          </FilterGroup>

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
      ) : null}

      <div className="mt-5 flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-bold">
          {filteredPeople.length === 1 ? "1 person" : `${filteredPeople.length} people`}
        </h2>
        <p className="text-xs text-ink-muted">{sortLabels[sort]}</p>
      </div>

      {filteredPeople.length ? (
        <div className="mt-2 divide-y divide-ink/[0.07]">
          {sections.length
            ? sections.map((section) => (
                <section key={section.letter}>
                  {/* Below the search row, which holds the top of the page. */}
                  <h3 className="sticky top-[4.75rem] z-10 bg-porcelain/95 py-2 text-xs font-semibold text-ink-muted backdrop-blur">
                    {section.letter}
                  </h3>
                  <div className="divide-y divide-ink/[0.07]">
                    {section.people.map((person) => (
                      <PersonRow key={person.id} person={person} />
                    ))}
                  </div>
                </section>
              ))
            : filteredPeople.map((person) => (
                <PersonRow key={person.id} person={person} />
              ))}
        </div>
      ) : (
        <div className="px-6 py-14 text-center">
          <p className="font-display text-2xl">
            {people.length === 0 ? "Add your first person" : "No matches yet"}
          </p>
          <p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-ink-muted">
            {people.length === 0
              ? "Use the coral plus button when you meet someone."
              : "Try removing a filter or searching for something broader."}
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
  );
}

function FilterGroup({
  label,
  icon,
  children,
}: {
  label: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5">
        {icon}
        <p className="text-sm font-semibold">{label}</p>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function FilterChip({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={clsx(
        "rounded-xl px-3 py-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral",
        selected ? "bg-sage-strong text-white" : "bg-ink/[0.06] text-ink-muted hover:bg-ink/10",
      )}
    >
      {label}
    </button>
  );
}
