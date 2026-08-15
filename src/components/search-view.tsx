"use client";

import { MagnifyingGlass, X } from "@phosphor-icons/react";
import clsx from "clsx";
import Link from "next/link";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Avatar } from "@/components/avatar";
import { getApiResponseError } from "@/lib/http";
import { relativeDateLabel } from "@/lib/relative-time";
import {
  groupResultsByPerson,
  snippetAround,
  type SearchResult,
  type SearchResultKind,
} from "@/lib/search";

export type SearchablePerson = {
  id: string;
  fullName: string;
  preferredName: string | null;
  profilePhotoUrl: string | null;
};

type SearchResponse = {
  results?: SearchResult[];
  available?: boolean;
};

/** Sentence case, singular: the row says what one record is. */
const kindLabels: Record<SearchResultKind, string> = {
  person: "Person",
  update: "Update",
  note: "Note",
  interaction: "Interaction",
  class: "Class",
  reminder: "Reminder",
};

const debounceMs = 250;

const displayNameOf = (person: SearchablePerson) =>
  person.preferredName ?? person.fullName;

type SearchState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "unavailable" }
  | { status: "failed"; message: string }
  | { status: "ready"; results: SearchResult[]; query: string };

/**
 * The people directory filters a list it already holds and so can search on
 * every keystroke. This one asks the database, so the query is debounced and
 * every request but the newest is abandoned — a slow answer to an old query
 * must never overwrite a fast answer to the current one.
 */
export function SearchView({
  people,
  initialQuery = "",
}: {
  people: SearchablePerson[];
  initialQuery?: string;
}) {
  const inputId = useId();
  // Seeded rather than pushed in through an effect, so arriving from the
  // directory's "nothing matched" link searches once instead of rendering an
  // idle box and then correcting itself.
  const [query, setQuery] = useState(initialQuery);
  const [state, setState] = useState<SearchState>({ status: "idle" });
  const requestId = useRef(0);

  useEffect(() => {
    const trimmed = query.trim();

    if (!trimmed) {
      requestId.current += 1;
      setState({ status: "idle" });
      return;
    }

    const controller = new AbortController();
    const id = requestId.current + 1;
    requestId.current = id;

    const timer = setTimeout(async () => {
      setState({ status: "loading" });

      try {
        const response = await fetch(
          `/api/search?q=${encodeURIComponent(trimmed)}`,
          { signal: controller.signal },
        );

        if (!response.ok) {
          const message = await getApiResponseError(
            response,
            "Search could not be completed. Try again.",
          );
          if (requestId.current === id) setState({ status: "failed", message });
          return;
        }

        const payload = (await response.json()) as SearchResponse;
        if (requestId.current !== id) return;

        if (payload.available === false) {
          setState({ status: "unavailable" });
          return;
        }

        setState({
          status: "ready",
          results: payload.results ?? [],
          query: trimmed,
        });
      } catch (error) {
        if (controller.signal.aborted) return;
        if (requestId.current !== id) return;
        setState({
          status: "failed",
          message:
            error instanceof Error
              ? error.message
              : "Search could not be completed. Try again.",
        });
      }
    }, debounceMs);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const grouping = useMemo(() => {
    if (state.status !== "ready") return null;
    return groupResultsByPerson(state.results, people);
  }, [people, state]);

  const hasResults =
    grouping !== null &&
    (grouping.people.length > 0 || grouping.loose.length > 0);

  return (
    <div>
      {/* Stays put while the results run under it, so refining a query does not
          mean scrolling back to the top first. */}
      <div className="sticky top-0 z-20 -mx-4 bg-porcelain/85 px-4 pb-3 pt-7 backdrop-blur sm:-mx-7 sm:px-7 lg:-mx-10 lg:px-10">
        <label htmlFor={inputId} className="sr-only">
          Search everything
        </label>
        <div className="relative">
          <MagnifyingGlass
            size={19}
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-muted"
            aria-hidden="true"
          />
          <input
            id={inputId}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search people, updates, notes…"
            autoComplete="off"
            className="h-12 w-full rounded-2xl border border-black/10 bg-paper pl-11 pr-11 text-sm text-ink outline-none transition [&::-webkit-search-cancel-button]:hidden placeholder:text-ink/35 focus:border-coral focus:ring-2 focus:ring-coral/20"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="absolute right-3 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded-full text-ink-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral"
            >
              <X size={14} weight="bold" aria-hidden="true" />
            </button>
          ) : null}
        </div>
      </div>

      <div aria-live="polite" aria-busy={state.status === "loading"}>
        {state.status === "idle" ? (
          <p className="mt-8 text-sm leading-6 text-ink-muted">
            Type to search across people, updates, notes, interactions, classes
            and reminders.
          </p>
        ) : null}

        {state.status === "loading" ? (
          <p className="mt-8 text-sm text-ink-muted">Searching…</p>
        ) : null}

        {state.status === "unavailable" ? (
          <p className="mt-8 text-sm leading-6 text-ink-muted">
            Search is waiting on its database migration. Once migration 0028 has
            been applied, everything here becomes searchable.
          </p>
        ) : null}

        {state.status === "failed" ? (
          <p role="alert" className="mt-8 text-sm leading-6 text-coral">
            {state.message}
          </p>
        ) : null}

        {state.status === "ready" && !hasResults ? (
          <p className="mt-8 text-sm leading-6 text-ink-muted">
            Nothing matched “{state.query}”. Try a word you would have written
            down rather than the exact phrase.
          </p>
        ) : null}
      </div>

      {state.status === "ready" && grouping && hasResults ? (
        <div className="mt-6 space-y-4">
          {grouping.people.map((group) => (
            <section
              key={group.person.id}
              className="rounded-3xl bg-paper p-4 shadow-card sm:p-5"
            >
              <Link
                href={`/people/${group.person.id}`}
                className="flex items-center gap-3 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral"
              >
                <Avatar
                  name={group.person.fullName}
                  imageUrl={group.person.profilePhotoUrl}
                  size="sm"
                />
                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">
                  {displayNameOf(group.person)}
                </span>
              </Link>
              <ResultList results={group.results} query={state.query} />
            </section>
          ))}

          {grouping.loose.length ? (
            <section className="rounded-3xl bg-paper p-4 shadow-card sm:p-5">
              <h2 className="text-sm font-semibold text-ink">
                Not tied to anyone
              </h2>
              <ResultList results={grouping.loose} query={state.query} />
            </section>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function ResultList({
  results,
  query,
}: {
  results: SearchResult[];
  query: string;
}) {
  return (
    <ul className="mt-3 space-y-2">
      {results.map((result) => (
        <li
          key={`${result.kind}-${result.recordId}`}
          className={clsx(
            "rounded-2xl bg-porcelain px-3 py-2.5",
            result.kind === "person" && "bg-mist",
          )}
        >
          <p className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-xs text-ink-muted">
            <span className="font-semibold text-ink">
              {kindLabels[result.kind]}
            </span>
            {result.title ? <span className="truncate">{result.title}</span> : null}
            {result.occurredAt ? (
              <span>{relativeDateLabel(result.occurredAt)}</span>
            ) : null}
          </p>
          {result.snippet ? (
            <p className="mt-1 text-sm leading-6 text-ink">
              {snippetAround(result.snippet, query)}
            </p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
