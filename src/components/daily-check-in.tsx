"use client";

import { Check, SpinnerGap, UsersThree } from "@phosphor-icons/react";
import clsx from "clsx";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Avatar } from "@/components/avatar";
import { EmptyState } from "@/components/empty-state";
import { matchesPeopleQuery } from "@/lib/people-filters";
import {
  alreadyLoggedIds,
  checkInCandidates,
  keepCheckInOrder,
} from "@/lib/daily-check-in";
import { getApiResponseError } from "@/lib/http";
import { lastSeenLabel } from "@/lib/relative-time";
import type { Person } from "@/lib/types";

/**
 * Everyone you saw today, in one pass.
 *
 * A tap saves straight away rather than staging a batch: the page can be opened
 * at lunch and again at nine, and whoever was logged since 4am is already ticked
 * when it opens. Untapping deletes the interaction again, so a mis-tap is not
 * something to live with.
 */
export function DailyCheckIn({ people }: { people: Person[] }) {
  const router = useRouter();
  // Fixed when the page opens, so saving a tick cannot rearrange the list.
  const [order] = useState(() =>
    checkInCandidates(people, new Date()).map((person) => person.id),
  );
  const candidates = useMemo(
    () => keepCheckInOrder(checkInCandidates(people, new Date()), order),
    [people, order],
  );
  const [selected, setSelected] = useState<string[]>(() =>
    alreadyLoggedIds(people, new Date()),
  );
  const [pending, setPending] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");

  /**
   * Searching looks at everyone, including anyone archived out of the roster
   * below. Filtering the list alone would mean the person you are hunting for
   * is exactly the person a search cannot find.
   */
  const visible = useMemo(() => {
    const trimmed = query.trim();
    if (!trimmed) return candidates;
    return people.filter((person) => matchesPeopleQuery(person, trimmed));
  }, [candidates, people, query]);

  async function toggle(personId: string) {
    const wasSelected = selected.includes(personId);
    setSelected((current) =>
      wasSelected ? current.filter((id) => id !== personId) : [...current, personId],
    );
    setPending((current) => [...current, personId]);
    setError("");

    try {
      const response = await fetch("/api/interactions/today", {
        method: wasSelected ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personId }),
      });
      if (!response.ok) {
        throw new Error(
          await getApiResponseError(response, "That could not be saved."),
        );
      }
      router.refresh();
    } catch (caughtError) {
      // Put the tick back where it was, so what is shown is what is stored.
      setSelected((current) =>
        wasSelected ? [...current, personId] : current.filter((id) => id !== personId),
      );
      setError(
        caughtError instanceof Error ? caughtError.message : "That could not be saved.",
      );
    } finally {
      setPending((current) => current.filter((id) => id !== personId));
    }
  }

  if (candidates.length === 0) {
    return (
      <div className="mt-8">
        <EmptyState
          icon={UsersThree}
          title="Nobody to log yet"
          body="Add someone to your circle and they will show up here."
        />
      </div>
    );
  }

  return (
    <div className="mt-8">
      <label className="block">
        <span className="sr-only">Search people</span>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search everyone"
          className="h-12 w-full rounded-2xl border border-black/10 bg-white px-4 text-sm text-ink outline-none transition placeholder:text-ink/35 focus:border-coral focus:ring-2 focus:ring-coral/20"
        />
      </label>

      {visible.length === 0 ? (
        <p className="mt-6 text-sm text-ink-muted">Nobody by that name yet.</p>
      ) : null}

      <ul className="mt-4 space-y-2">
        {visible.map((person) => {
          const chosen = selected.includes(person.id);
          const busy = pending.includes(person.id);
          return (
            <li key={person.id}>
              <button
                type="button"
                aria-pressed={chosen}
                onClick={() => void toggle(person.id)}
                className={clsx(
                  "flex w-full items-center gap-3.5 rounded-2xl p-3.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral",
                  chosen ? "bg-sage" : "bg-white hover:bg-mist/40",
                )}
              >
                <Avatar
                  name={person.preferredName || person.fullName}
                  imageUrl={person.profilePhotoUrl}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">
                    {person.preferredName || person.fullName}
                  </span>
                  <span className="block text-xs text-ink-muted">
                    {chosen ? "Logged today" : lastSeenLabel(person.lastInteractionAt)}
                  </span>
                </span>
                <span
                  className={clsx(
                    "grid size-6 shrink-0 place-items-center rounded-full",
                    chosen ? "bg-sage-strong text-white" : "bg-mist",
                  )}
                >
                  {busy ? (
                    <SpinnerGap size={13} className="animate-spin" aria-hidden="true" />
                  ) : chosen ? (
                    <Check size={14} weight="bold" aria-hidden="true" />
                  ) : null}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {error ? <p className="mt-4 text-sm text-coral-strong">{error}</p> : null}

      {/* Every tap is already saved, so this only leaves. It is here because a
          screen with no way out and no button reads as unfinished, and people
          sit on it wondering what they have not pressed. */}
      <div className="mt-7 flex items-center justify-between gap-4">
        <p className="text-xs text-ink-muted">
          Saved as you go. Tap again to undo.
        </p>
        <button
          type="button"
          onClick={() => router.push("/today")}
          disabled={pending.length > 0}
          className="inline-flex h-11 shrink-0 items-center justify-center rounded-2xl bg-ink px-6 text-sm font-semibold text-white transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral focus-visible:ring-offset-2 disabled:opacity-60"
        >
          {pending.length > 0 ? "Saving…" : "Done"}
        </button>
      </div>
    </div>
  );
}
