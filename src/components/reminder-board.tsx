"use client";

import { Bell, Check, MagnifyingGlass, NotePencil, Trash } from "@phosphor-icons/react";
import clsx from "clsx";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Avatar } from "@/components/avatar";
import {
  countsByBucket,
  reminderBucketEmptyLabels,
  reminderBucketLabels,
  reminderBucketOrder,
  groupRemindersByBucket,
  type ReminderBucket,
} from "@/lib/reminder-buckets";
import { dueDateLabel } from "@/lib/relative-time";
import { reminderPeopleLabel } from "@/lib/reminder-people";
import type { Reminder } from "@/lib/types";

function matchesQuery(reminder: Reminder, query: string) {
  return [
    reminder.text,
    // Every name, not only the two the row shows: searching for the person who
    // came third must still find the reminder they are on.
    ...reminder.people.flatMap((person) => [
      person.fullName,
      person.preferredName,
    ]),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .includes(query);
}

export function ReminderBoard({
  initialReminders,
  initialQuery = "",
}: {
  initialReminders: Reminder[];
  initialQuery?: string;
}) {
  const [reminders, setReminders] = useState(initialReminders);
  const [query, setQuery] = useState(initialQuery);
  const [focusedBucket, setFocusedBucket] = useState<ReminderBucket | null>(
    null,
  );
  const [showCompleted, setShowCompleted] = useState(false);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const router = useRouter();

  // A reminder completed in this session keeps its place in the list so the
  // page never jumps out from under the tap that completed it.
  const settledIds = useRef(new Set<string>());

  useEffect(() => {
    setReminders(initialReminders);
  }, [initialReminders]);

  const { groups, completed, counts } = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const visible = reminders.filter((reminder) =>
      matchesQuery(reminder, normalized),
    );
    const stayingInPlace = visible.filter(
      (reminder) => !reminder.completedAt || settledIds.current.has(reminder.id),
    );
    const { groups: openGroups } = groupRemindersByBucket(
      stayingInPlace.map((reminder) => ({ ...reminder, completedAt: null })),
    );
    const byId = new Map(visible.map((reminder) => [reminder.id, reminder]));
    const restored = {} as Record<ReminderBucket, Reminder[]>;
    for (const bucket of reminderBucketOrder) {
      restored[bucket] = openGroups[bucket].map(
        (reminder) => byId.get(reminder.id)!,
      );
    }
    return {
      groups: restored,
      completed: visible.filter(
        (reminder) =>
          reminder.completedAt && !settledIds.current.has(reminder.id),
      ),
      counts: countsByBucket({
        overdue: restored.overdue.filter((item) => !item.completedAt),
        today: restored.today.filter((item) => !item.completedAt),
        week: restored.week.filter((item) => !item.completedAt),
        later: restored.later.filter((item) => !item.completedAt),
      }),
    };
  }, [query, reminders]);

  async function saveEdit(reminder: Reminder, text: string, dueOn: string) {
    const trimmed = text.trim();
    if (!trimmed || !dueOn) return;

    setWorkingId(reminder.id);
    // Kept at the hour it already had, so rescheduling to another day does not
    // quietly move a morning reminder to midnight.
    const dueAt = new Date(reminder.dueAt);
    const [year, month, day] = dueOn.split("-").map(Number);
    dueAt.setFullYear(year, month - 1, day);

    if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
      const response = await fetch(`/api/reminders/${reminder.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: trimmed, dueAt: dueAt.toISOString() }),
      });
      if (!response.ok) {
        setWorkingId(null);
        return;
      }
    }

    setReminders((current) =>
      current.map((entry) =>
        entry.id === reminder.id
          ? { ...entry, text: trimmed, dueAt: dueAt.toISOString() }
          : entry,
      ),
    );
    setEditingId(null);
    setWorkingId(null);
    router.refresh();
  }

  async function removeReminder(reminder: Reminder) {
    setWorkingId(reminder.id);

    if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
      const response = await fetch(`/api/reminders/${reminder.id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        setWorkingId(null);
        return;
      }
    }

    setReminders((current) => current.filter((entry) => entry.id !== reminder.id));
    setEditingId(null);
    setWorkingId(null);
    router.refresh();
  }

  async function toggleComplete(reminder: Reminder) {
    setWorkingId(reminder.id);
    const completedAt = reminder.completedAt ? null : new Date().toISOString();
    settledIds.current.add(reminder.id);

    if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
      const response = await fetch(`/api/reminders/${reminder.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completedAt }),
      });
      if (!response.ok) {
        setWorkingId(null);
        return;
      }
    } else {
      await new Promise((resolve) => window.setTimeout(resolve, 220));
    }

    setReminders((currentReminders) =>
      currentReminders.map((currentReminder) =>
        currentReminder.id === reminder.id
          ? { ...currentReminder, completedAt }
          : currentReminder,
      ),
    );
    setWorkingId(null);
  }

  const shownBuckets = focusedBucket ? [focusedBucket] : reminderBucketOrder;
  const openTotal = reminderBucketOrder.reduce(
    (total, bucket) => total + counts[bucket],
    0,
  );

  return (
    <div>
      <div
        role="tablist"
        aria-label="How your reminders are spread out"
        className="mt-7 grid grid-cols-4 border-y border-ink/[0.08]"
      >
        {reminderBucketOrder.map((bucket) => {
          const focused = focusedBucket === bucket;
          return (
            <button
              key={bucket}
              type="button"
              role="tab"
              aria-selected={focused}
              onClick={() => setFocusedBucket(focused ? null : bucket)}
              className={clsx(
                "flex min-h-[5.25rem] flex-col justify-center gap-1 py-4 pr-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral",
                bucket !== "overdue" && "border-l border-ink/[0.08] pl-3",
                focused && "border-b-2 border-b-ink",
              )}
            >
              <span
                className={clsx(
                  "font-display text-3xl leading-none tabular-nums",
                  counts[bucket] === 0 && "text-ink/25",
                  bucket === "overdue" &&
                    counts[bucket] > 0 &&
                    "text-coral-strong",
                )}
              >
                {counts[bucket]}
              </span>
              <span className="text-[11px] font-semibold leading-4 text-ink-muted">
                {reminderBucketLabels[bucket]}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex items-center gap-3">
        <label className="relative flex-1">
          <span className="sr-only">Filter reminders</span>
          <MagnifyingGlass
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted"
            aria-hidden="true"
          />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Person or reminder"
            className="h-11 w-full rounded-lg border border-black/10 bg-white pl-9 pr-3 text-sm text-ink outline-none placeholder:text-ink-muted focus:border-coral focus:ring-2 focus:ring-coral/20"
          />
        </label>
        <button
          type="button"
          onClick={() => setShowCompleted((value) => !value)}
          aria-expanded={showCompleted}
          className="shrink-0 text-xs font-semibold text-ink-muted underline underline-offset-4 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral"
        >
          {showCompleted ? "Hide done" : `Done (${completed.length})`}
        </button>
      </div>

      {openTotal === 0 && !showCompleted ? (
        <div className="py-10">
          <Bell size={28} className="text-ink-muted" aria-hidden="true" />
          <p className="mt-3 font-display text-2xl">
            {reminders.length === 0 ? "No reminders yet" : "Nothing is waiting"}
          </p>
          <p className="mt-2 max-w-sm text-sm leading-6 text-ink-muted">
            {reminders.length === 0
              ? "Add a reminder and it will show up here."
              : "Everything here is either done or filtered out."}
          </p>
        </div>
      ) : (
        shownBuckets.map((bucket) => (
          <section
            key={bucket}
            className="pt-6"
            aria-labelledby={`reminders-${bucket}-heading`}
          >
            <div className="flex items-baseline justify-between gap-3 border-b border-ink/[0.08] pb-2">
              <h2
                id={`reminders-${bucket}-heading`}
                className={clsx(
                  "text-sm font-bold",
                  bucket === "overdue" &&
                    counts[bucket] > 0 &&
                    "text-coral-strong",
                )}
              >
                {reminderBucketLabels[bucket]}
              </h2>
              <span className="text-[11px] font-semibold tabular-nums text-ink-muted">
                {counts[bucket]}
              </span>
            </div>
            {groups[bucket].length ? (
              <ul>
                {groups[bucket].map((reminder) => (
                  <ReminderRow
                    key={reminder.id}
                    reminder={reminder}
                    busy={workingId === reminder.id}
                    onToggle={() => toggleComplete(reminder)}
                    editing={editingId === reminder.id}
                    onEdit={() => setEditingId(reminder.id)}
                    onCancelEdit={() => setEditingId(null)}
                    onSave={(text, dueOn) => void saveEdit(reminder, text, dueOn)}
                    onDelete={() => void removeReminder(reminder)}
                    overdue={bucket === "overdue"}
                  />
                ))}
              </ul>
            ) : (
              <p className="flex min-h-[3.5rem] items-center text-xs text-ink-muted">
                {reminderBucketEmptyLabels[bucket]}
              </p>
            )}
          </section>
        ))
      )}

      {showCompleted ? (
        <section className="pt-6" aria-labelledby="reminders-done-heading">
          <div className="flex items-baseline justify-between gap-3 border-b border-ink/[0.08] pb-2">
            <h2 id="reminders-done-heading" className="text-sm font-bold">
              Done
            </h2>
            <span className="text-[11px] font-semibold tabular-nums text-ink-muted">
              {completed.length}
            </span>
          </div>
          {completed.length ? (
            <ul>
              {completed.map((reminder) => (
                <ReminderRow
                  key={reminder.id}
                  reminder={reminder}
                  busy={workingId === reminder.id}
                  onToggle={() => toggleComplete(reminder)}
                  editing={editingId === reminder.id}
                  onEdit={() => setEditingId(reminder.id)}
                  onCancelEdit={() => setEditingId(null)}
                  onSave={(text, dueOn) => void saveEdit(reminder, text, dueOn)}
                  onDelete={() => void removeReminder(reminder)}
                />
              ))}
            </ul>
          ) : (
            <p className="flex min-h-[3.5rem] items-center text-xs text-ink-muted">
              Nothing finished yet.
            </p>
          )}
        </section>
      ) : null}
    </div>
  );
}

function ReminderRow({
  reminder,
  busy,
  onToggle,
  editing,
  onEdit,
  onCancelEdit,
  onSave,
  onDelete,
  overdue = false,
}: {
  reminder: Reminder;
  busy: boolean;
  onToggle: () => void;
  editing: boolean;
  onEdit: () => void;
  onCancelEdit: () => void;
  onSave: (text: string, dueOn: string) => void;
  onDelete: () => void;
  overdue?: boolean;
}) {
  const name = reminderPeopleLabel(reminder.people) || "Someone";
  const done = Boolean(reminder.completedAt);

  const copy = (
    <>
      <span
        className={clsx(
          "block text-sm font-semibold leading-5",
          done && "text-ink-muted line-through",
        )}
      >
        {reminder.text}
      </span>
      <span className="mt-1 block truncate text-[11px] text-ink-muted">
        {name}
        {done ? "" : ` · ${dueDateLabel(reminder.dueAt)}`}
      </span>
    </>
  );

  if (editing) {
    return (
      <li className="border-b border-ink/[0.055] py-3">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            onSave(String(form.get("text") ?? ""), String(form.get("dueOn") ?? ""));
          }}
          className="flex flex-col gap-2"
        >
          <input
            name="text"
            defaultValue={reminder.text}
            aria-label="What to remember"
            maxLength={500}
            autoFocus
            className="w-full rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm outline-none focus:border-coral focus:ring-2 focus:ring-coral/20"
          />
          <div className="flex flex-wrap items-center gap-2">
            <input
              name="dueOn"
              type="date"
              defaultValue={reminder.dueAt.slice(0, 10)}
              aria-label="Due date"
              className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-coral focus:ring-2 focus:ring-coral/20"
            />
            <button
              type="submit"
              disabled={busy}
              className="h-10 rounded-full bg-coral px-4 text-sm font-semibold text-white transition-colors hover:bg-coral-strong disabled:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral"
            >
              Save
            </button>
            <button
              type="button"
              onClick={onCancelEdit}
              className="h-10 rounded-full px-3 text-sm font-semibold text-ink-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onDelete}
              disabled={busy}
              aria-label={`Delete “${reminder.text}”`}
              className="ml-auto grid size-10 place-items-center rounded-full text-ink-muted transition-colors hover:bg-mist hover:text-coral-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral"
            >
              <Trash size={16} aria-hidden="true" />
            </button>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li className="flex min-h-[4.25rem] items-center gap-3 border-b border-ink/[0.055] py-3">
      <Avatar
        name={reminder.people[0]?.fullName ?? "Someone"}
        imageUrl={reminder.people[0]?.profilePhotoUrl}
        size="sm"
      />

      <div className="min-w-0 flex-1">
        {/* Linked only when there is one person to open. Several would make the
            row pick a favourite, and the name beside it already lists them. */}
        {reminder.people.length === 1 ? (
          <Link
            href={`/people/${reminder.people[0].id}`}
            className="block rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral"
          >
            {copy}
          </Link>
        ) : (
          copy
        )}
      </div>

      <button
        type="button"
        onClick={onEdit}
        aria-label={`Edit “${reminder.text}”`}
        className="grid size-9 shrink-0 place-items-center rounded-full text-ink-muted transition-colors hover:bg-mist hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral"
      >
        <NotePencil size={16} aria-hidden="true" />
      </button>

      <button
        type="button"
        onClick={onToggle}
        disabled={busy}
        className={clsx(
          "grid size-9 shrink-0 place-items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral",
          done ? "bg-sage-strong text-white" : "bg-mist",
          !done && (overdue ? "text-coral-strong" : "text-ink-muted"),
        )}
        aria-label={
          done
            ? `Mark “${reminder.text}” incomplete`
            : `Mark “${reminder.text}” complete`
        }
      >
        <Check size={17} weight="bold" aria-hidden="true" />
      </button>
    </li>
  );
}
