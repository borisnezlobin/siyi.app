"use client";

import { Check, UsersThree } from "@phosphor-icons/react";
import clsx from "clsx";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Avatar } from "@/components/avatar";
import { checkInCandidates, lastSeenLabel } from "@/lib/daily-check-in";
import { getApiResponseError } from "@/lib/http";
import type { Person } from "@/lib/types";

/**
 * "Who did you talk to today?" — the whole point is that it takes one pass and
 * no typing, so everyone is a single click and one button saves the lot.
 */
export function DailyCheckIn({ people }: { people: Person[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const candidates = useMemo(() => checkInCandidates(people, new Date(), 24), [people]);

  async function save() {
    if (selected.length === 0) return;
    setSaving(true);
    setError("");
    try {
      const occurredAt = new Date().toISOString();
      for (const personId of selected) {
        const response = await fetch("/api/interactions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ personId, type: "other", occurredAt, note: null }),
        });
        if (!response.ok) {
          throw new Error(
            await getApiResponseError(response, "That could not be saved."),
          );
        }
      }
      router.push("/today");
      router.refresh();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error ? caughtError.message : "That could not be saved.",
      );
      setSaving(false);
    }
  }

  if (candidates.length === 0) {
    return (
      <div className="mt-8 rounded-3xl bg-white px-6 py-14 text-center">
        <UsersThree size={30} className="mx-auto text-ink-muted" aria-hidden="true" />
        <p className="mt-3 font-display text-2xl">All caught up</p>
        <p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-ink-muted">
          Everyone you might have seen is already logged for today.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-8">
      <ul className="space-y-2">
        {candidates.map((person) => {
          const chosen = selected.includes(person.id);
          return (
            <li key={person.id}>
              <button
                type="button"
                aria-pressed={chosen}
                onClick={() =>
                  setSelected((current) =>
                    current.includes(person.id)
                      ? current.filter((id) => id !== person.id)
                      : [...current, person.id],
                  )
                }
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
                    {lastSeenLabel(person)}
                  </span>
                </span>
                <span
                  className={clsx(
                    "grid size-6 shrink-0 place-items-center rounded-full",
                    chosen ? "bg-sage-strong text-white" : "bg-mist",
                  )}
                >
                  {chosen ? <Check size={14} weight="bold" aria-hidden="true" /> : null}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {error ? <p className="mt-4 text-sm text-coral-strong">{error}</p> : null}

      <button
        type="button"
        disabled={selected.length === 0 || saving}
        onClick={() => void save()}
        className="mt-6 w-full rounded-2xl bg-coral px-4 py-3.5 text-sm font-semibold text-white disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral focus-visible:ring-offset-2"
      >
        {selected.length === 0
          ? "Pick anyone you saw"
          : selected.length === 1
            ? "Log 1 person"
            : `Log ${selected.length} people`}
      </button>
    </div>
  );
}
