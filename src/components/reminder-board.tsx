"use client";

import { CaretDown, Check, ClockCountdown } from "@phosphor-icons/react";
import clsx from "clsx";
import { format } from "date-fns";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Avatar } from "@/components/avatar";
import {
  countsByBucket,
  reminderBucketEmptyLabels,
  reminderBucketLabels,
  reminderBucketOrder,
  reminderDueLabel,
  groupRemindersByBucket,
  type ReminderBucket,
} from "@/lib/reminder-buckets";
import type { Reminder, Person } from "@/lib/types";

export function ReminderBoard({
  initialReminders,
  people,
  initialPersonId = "all",
}: {
  initialReminders: Reminder[];
  people: Person[];
  initialPersonId?: string;
}) {
  const [reminders, setReminders] = useState(initialReminders);
  const [personId, setPersonId] = useState(initialPersonId);
  const [showCompleted, setShowCompleted] = useState(false);
  const [workingId, setWorkingId] = useState<string | null>(null);

  // A reminder completed in this session keeps its place in the list so the
  // page never jumps out from under the tap that completed it.
  const settledIds = useRef(new Set<string>());

  useEffect(() => {
    setReminders(initialReminders);
  }, [initialReminders]);

  const forPerson = useMemo(
    () =>
      personId === "all"
        ? reminders
        : reminders.filter((reminder) => reminder.personId === personId),
    [reminders, personId],
  );

  const { groups, completed } = useMemo(() => {
    const stayingInPlace = forPerson.filter(
      (reminder) => !reminder.completedAt || settledIds.current.has(reminder.id),
    );
    const { groups: openGroups } = groupRemindersByBucket(
      stayingInPlace.map((reminder) => ({ ...reminder, completedAt: null })),
    );
    const byId = new Map(forPerson.map((reminder) => [reminder.id, reminder]));
    const restored = {} as Record<ReminderBucket, Reminder[]>;
    for (const bucket of reminderBucketOrder) {
      restored[bucket] = openGroups[bucket].map(
        (reminder) => byId.get(reminder.id)!,
      );
    }
    const doneItems = forPerson.filter(
      (reminder) => reminder.completedAt && !settledIds.current.has(reminder.id),
    );
    return { groups: restored, completed: doneItems };
  }, [forPerson]);

  const counts = countsByBucket({
    overdue: groups.overdue.filter((item) => !item.completedAt),
    today: groups.today.filter((item) => !item.completedAt),
    week: groups.week.filter((item) => !item.completedAt),
    later: groups.later.filter((item) => !item.completedAt),
  });
  const listedTotal = reminderBucketOrder.reduce(
    (total, bucket) => total + groups[bucket].length,
    0,
  );

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

  return (
    <div>
      <section
        aria-label="How your reminders are spread out"
        className="mt-7 grid grid-cols-4 border-y border-ink/[0.08]"
      >
        {reminderBucketOrder.map((bucket) => (
          <a
            key={bucket}
            href={`#reminders-${bucket}`}
            className={clsx(
              "flex min-h-[5.25rem] flex-col justify-center gap-1 py-4 pr-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral",
              bucket !== "overdue" && "border-l border-ink/[0.08] pl-3",
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
          </a>
        ))}
      </section>

      <div className="mt-4 flex items-center gap-3">
        <label className="relative flex-1">
          <span className="sr-only">Filter by person</span>
          <select
            value={personId}
            onChange={(event) => setPersonId(event.target.value)}
            className="h-10 w-full appearance-none rounded-lg border border-black/10 bg-white pl-3 pr-9 text-xs text-ink outline-none focus:border-coral focus:ring-2 focus:ring-coral/20"
          >
            <option value="all">Every person</option>
            {people.map((person) => (
              <option key={person.id} value={person.id}>
                {person.preferredName ?? person.fullName}
              </option>
            ))}
          </select>
          <CaretDown
            size={13}
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted"
            aria-hidden="true"
          />
        </label>
        <button
          type="button"
          onClick={() => setShowCompleted((value) => !value)}
          aria-pressed={showCompleted}
          className="shrink-0 text-xs font-semibold text-ink-muted underline-offset-4 hover:text-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral"
        >
          {showCompleted ? "Hide done" : `Done (${completed.length})`}
        </button>
      </div>

      {listedTotal === 0 && !showCompleted ? (
        <div className="mt-10 py-10 text-center">
          <ClockCountdown
            size={30}
            className="mx-auto text-ink/30"
            aria-hidden="true"
          />
          <p className="mt-4 font-display text-2xl">Nothing is waiting.</p>
          <p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-ink-muted">
            Reminders land here when you add something you want to remember.
          </p>
        </div>
      ) : (
        <div className="mt-2">
          {reminderBucketOrder.map((bucket) => (
            <section
              key={bucket}
              id={`reminders-${bucket}`}
              className="scroll-mt-6 pt-6"
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
                <ul className="divide-y divide-ink/[0.055]">
                  {groups[bucket].map((reminder) => (
                    <ReminderRow
                      key={reminder.id}
                      reminder={reminder}
                      busy={workingId === reminder.id}
                      onToggle={() => toggleComplete(reminder)}
                    />
                  ))}
                </ul>
              ) : (
                <p className="flex min-h-[3.5rem] items-center text-xs text-ink-muted">
                  {reminderBucketEmptyLabels[bucket]}
                </p>
              )}
            </section>
          ))}

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
                <ul className="divide-y divide-ink/[0.055]">
                  {completed.map((reminder) => (
                    <ReminderRow
                      key={reminder.id}
                      reminder={reminder}
                      busy={workingId === reminder.id}
                      onToggle={() => toggleComplete(reminder)}
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
      )}
    </div>
  );
}

function ReminderRow({
  reminder,
  busy,
  onToggle,
}: {
  reminder: Reminder;
  busy: boolean;
  onToggle: () => void;
}) {
  const person = reminder.person;
  const done = Boolean(reminder.completedAt);

  return (
    <li className="flex min-h-[4.25rem] items-center gap-3 py-3">
      <button
        type="button"
        onClick={onToggle}
        disabled={busy}
        className={clsx(
          "grid size-8 shrink-0 place-items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral",
          done
            ? "bg-sage-strong text-white"
            : "bg-mist text-ink/40 hover:bg-sage-strong hover:text-white",
        )}
        aria-label={
          done
            ? `Mark “${reminder.text}” incomplete`
            : `Mark “${reminder.text}” complete`
        }
      >
        <Check size={16} weight="bold" aria-hidden="true" />
      </button>

      <div className="min-w-0 flex-1">
        <p
          className={clsx(
            "text-sm font-semibold leading-5",
            done && "text-ink-muted line-through",
          )}
        >
          {reminder.text}
        </p>
        {person ? (
          <Link
            href={`/people/${person.id}`}
            className="mt-1.5 flex min-w-0 items-center gap-1.5 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral"
          >
            <Avatar
              name={person.fullName}
              imageUrl={person.profilePhotoUrl}
              size="xs"
            />
            <span className="truncate text-[11px] text-ink-muted">
              {person.preferredName ?? person.fullName}
            </span>
          </Link>
        ) : null}
      </div>

      <span className="shrink-0 text-right text-[11px] leading-4 text-ink-muted">
        {done ? (
          <>Done {format(new Date(reminder.completedAt!), "MMM d")}</>
        ) : (
          <>
            <span className="block font-semibold text-ink">
              {reminderDueLabel(reminder.dueAt)}
            </span>
            {format(new Date(reminder.dueAt), "MMM d")}
          </>
        )}
      </span>
    </li>
  );
}
