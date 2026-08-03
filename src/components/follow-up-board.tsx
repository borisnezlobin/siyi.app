"use client";

import {
  CalendarBlank,
  CaretDown,
  Check,
  CheckCircle,
} from "@phosphor-icons/react";
import clsx from "clsx";
import {
  addDays,
  format,
  isAfter,
  isBefore,
  isSameDay,
  startOfDay,
} from "date-fns";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Avatar } from "@/components/avatar";
import type { FollowUp, Person } from "@/lib/types";

type FollowUpGroup = "overdue" | "today" | "upcoming" | "completed";
type DueWindow = "all" | "week" | "month";

const groupLabels: Record<FollowUpGroup, string> = {
  overdue: "Overdue",
  today: "Due today",
  upcoming: "Upcoming",
  completed: "Completed",
};

export function FollowUpBoard({
  initialFollowUps,
  people,
  initialPersonId = "all",
}: {
  initialFollowUps: FollowUp[];
  people: Person[];
  initialPersonId?: string;
}) {
  const [followUps, setFollowUps] = useState(initialFollowUps);
  const [group, setGroup] = useState<FollowUpGroup>("overdue");
  const [personId, setPersonId] = useState(initialPersonId);
  const [dueWindow, setDueWindow] = useState<DueWindow>("all");
  const [workingId, setWorkingId] = useState<string | null>(null);
  const today = startOfDay(new Date());

  const groupedCounts = useMemo(() => {
    return followUps.reduce(
      (counts, followUp) => {
        if (followUp.completedAt) {
          counts.completed += 1;
        } else {
          const dueDate = startOfDay(new Date(followUp.dueAt));
          if (isBefore(dueDate, today)) counts.overdue += 1;
          else if (isSameDay(dueDate, today)) counts.today += 1;
          else counts.upcoming += 1;
        }
        return counts;
      },
      { overdue: 0, today: 0, upcoming: 0, completed: 0 },
    );
  }, [followUps, today]);

  const visibleFollowUps = useMemo(() => {
    return followUps.filter((followUp) => {
      if (personId !== "all" && followUp.personId !== personId) return false;

      const dueDate = startOfDay(new Date(followUp.dueAt));
      if (
        dueWindow === "week" &&
        (isBefore(dueDate, today) || isAfter(dueDate, addDays(today, 7)))
      ) {
        return false;
      }
      if (
        dueWindow === "month" &&
        (isBefore(dueDate, today) || isAfter(dueDate, addDays(today, 30)))
      ) {
        return false;
      }

      if (group === "completed") return Boolean(followUp.completedAt);
      if (followUp.completedAt) return false;
      if (group === "overdue") return isBefore(dueDate, today);
      if (group === "today") return isSameDay(dueDate, today);
      return isAfter(dueDate, today);
    });
  }, [dueWindow, followUps, group, personId, today]);

  async function toggleComplete(followUp: FollowUp) {
    setWorkingId(followUp.id);
    const completedAt = followUp.completedAt ? null : new Date().toISOString();

    if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
      const response = await fetch(`/api/follow-ups/${followUp.id}`, {
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

    setFollowUps((currentFollowUps) =>
      currentFollowUps.map((currentFollowUp) =>
        currentFollowUp.id === followUp.id
          ? { ...currentFollowUp, completedAt }
          : currentFollowUp,
      ),
    );
    setWorkingId(null);
  }

  return (
    <div>
      <div className="mt-7 flex gap-2 overflow-x-auto pb-2">
        {(Object.keys(groupLabels) as FollowUpGroup[]).map((groupName) => (
          <button
            key={groupName}
            type="button"
            onClick={() => setGroup(groupName)}
            className={clsx(
              "flex shrink-0 items-center gap-2 rounded-full px-3.5 py-2.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral",
              group === groupName
                ? "bg-ink text-white shadow-card"
                : "bg-white text-ink-muted shadow-card ring-1 ring-black/[0.035]",
            )}
            aria-pressed={group === groupName}
          >
            {groupLabels[groupName]}
            <span
              className={clsx(
                "grid min-w-5 place-items-center rounded-full px-1 py-0.5 text-[9px]",
                group === groupName ? "bg-white/14 text-white" : "bg-porcelain text-ink",
              )}
            >
              {groupedCounts[groupName]}
            </span>
          </button>
        ))}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <label className="relative">
          <span className="sr-only">Filter by person</span>
          <select
            value={personId}
            onChange={(event) => setPersonId(event.target.value)}
            className="h-11 w-full appearance-none rounded-xl border border-black/10 bg-white px-3 pr-9 text-xs text-ink outline-none focus:border-coral focus:ring-2 focus:ring-coral/20"
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
        <label className="relative">
          <span className="sr-only">Filter by due date</span>
          <select
            value={dueWindow}
            onChange={(event) => setDueWindow(event.target.value as DueWindow)}
            className="h-11 w-full appearance-none rounded-xl border border-black/10 bg-white px-3 pr-9 text-xs text-ink outline-none focus:border-coral focus:ring-2 focus:ring-coral/20"
          >
            <option value="all">Any due date</option>
            <option value="week">Next 7 days</option>
            <option value="month">Next 30 days</option>
          </select>
          <CaretDown
            size={13}
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted"
            aria-hidden="true"
          />
        </label>
      </div>

      <div className="mt-5 space-y-3">
        {visibleFollowUps.length ? (
          visibleFollowUps.map((followUp) => {
            const person = followUp.person;
            return (
              <article
                key={followUp.id}
                className="flex items-center gap-3 rounded-[1.4rem] bg-white p-3 shadow-card ring-1 ring-black/[0.035] sm:p-4"
              >
                <button
                  type="button"
                  onClick={() => toggleComplete(followUp)}
                  disabled={workingId === followUp.id}
                  className={clsx(
                    "grid size-10 shrink-0 place-items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral",
                    followUp.completedAt
                      ? "bg-sage text-sage-strong"
                      : "bg-porcelain text-ink/30 hover:bg-sage hover:text-sage-strong",
                  )}
                  aria-label={
                    followUp.completedAt
                      ? `Mark “${followUp.text}” incomplete`
                      : `Mark “${followUp.text}” complete`
                  }
                >
                  <Check
                    size={18}
                    weight={followUp.completedAt ? "bold" : "regular"}
                    aria-hidden="true"
                  />
                </button>

                <div className="min-w-0 flex-1">
                  <p
                    className={clsx(
                      "text-sm font-semibold leading-5",
                      followUp.completedAt && "text-ink-muted line-through",
                    )}
                  >
                    {followUp.text}
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    {person ? (
                      <Link
                        href={`/people/${person.id}`}
                        className="flex min-w-0 items-center gap-1.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral"
                      >
                        <Avatar
                          name={person.fullName}
                          imageUrl={person.profilePhotoUrl}
                          size="xs"
                        />
                        <span className="truncate text-[10px] font-semibold text-ink-muted">
                          {person.preferredName ?? person.fullName}
                        </span>
                      </Link>
                    ) : null}
                    <span className="flex items-center gap-1 text-[10px] text-ink-muted">
                      <CalendarBlank size={12} aria-hidden="true" />
                      {followUp.completedAt
                        ? `Done ${format(new Date(followUp.completedAt), "MMM d")}`
                        : `Due ${format(new Date(followUp.dueAt), "MMM d")}`}
                    </span>
                  </div>
                </div>
              </article>
            );
          })
        ) : (
          <div className="rounded-3xl bg-white px-6 py-10 text-center shadow-card ring-1 ring-black/[0.035]">
            <span className="mx-auto grid size-12 place-items-center rounded-full bg-sage text-sage-strong">
              <CheckCircle size={25} weight="fill" aria-hidden="true" />
            </span>
            <p className="mt-4 font-display text-2xl">
              Nothing here right now.
            </p>
            <p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-ink-muted">
              Follow-ups land here when you add something you want to remember.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
