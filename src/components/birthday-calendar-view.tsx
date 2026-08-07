"use client";

import { Cake } from "@phosphor-icons/react";
import clsx from "clsx";
import Link from "next/link";
import { useState } from "react";
import { EmptyState } from "@/components/empty-state";
import {
  birthdayCountdownLabel,
  birthdaysByMonth,
  upcomingBirthdays,
  type BirthdayPerson,
} from "@/lib/birthday-calendar";

const monthShort = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const views = [
  { id: "upcoming", label: "Coming up" },
  { id: "year", label: "Whole year" },
] as const;

type BirthdayView = (typeof views)[number]["id"];

function nameOf(person: BirthdayPerson) {
  return person.preferredName || person.fullName;
}

export function BirthdayCalendarView({
  people,
}: {
  people: BirthdayPerson[];
}) {
  const [view, setView] = useState<BirthdayView>("upcoming");
  const months = birthdaysByMonth(people);
  const upcoming = upcomingBirthdays(people, new Date(), 120);
  const withBirthday = people.filter((person) => person.birthday).length;
  const currentMonth = new Date().getMonth();

  return (
    <div className="mt-8">
      <div
        role="tablist"
        aria-label="Birthday view"
        className="flex gap-1 rounded-2xl bg-mist p-1"
      >
        {views.map((option) => (
          <button
            key={option.id}
            type="button"
            role="tab"
            aria-selected={view === option.id}
            onClick={() => setView(option.id)}
            className={clsx(
              "flex-1 rounded-xl py-2.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral",
              view === option.id ? "bg-white text-ink" : "text-ink-muted",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      {withBirthday === 0 ? (
        <div className="mt-6">
          <EmptyState
            icon={Cake}
            title="No birthdays saved yet"
            body="Add a birthday to someone's profile and it will show up here."
          />
        </div>
      ) : view === "upcoming" ? (
        <div className="mt-6">
          {upcoming.length === 0 ? (
            <p className="text-sm text-ink-muted">
              Nothing in the next four months. Switch to the whole year.
            </p>
          ) : (
            <div className="divide-y divide-ink/[0.055] overflow-hidden rounded-3xl bg-white px-4">
              {upcoming.map((entry) => (
                <Link
                  key={entry.person.id}
                  href={`/people/${entry.person.id}`}
                  className="flex items-center gap-3.5 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral"
                >
                  <span className="grid min-w-14 place-items-center rounded-xl bg-mist px-3 py-2">
                    <span className="text-[11px] font-semibold text-ink-muted">
                      {monthShort[entry.month]}
                    </span>
                    <span className="font-display text-xl leading-none">
                      {entry.day}
                    </span>
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">
                      {nameOf(entry.person)}
                    </span>
                    <span className="mt-0.5 block text-xs text-ink-muted">
                      {birthdayCountdownLabel(entry.daysAway)}
                      {entry.turningAge ? ` · turning ${entry.turningAge}` : ""}
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="mt-6 space-y-5">
          {months.map((month) => (
            <div key={month.month}>
              <h2
                className={clsx(
                  "text-sm font-semibold",
                  month.month === currentMonth ? "text-coral" : "text-ink-muted",
                )}
              >
                {month.label}
              </h2>
              {month.entries.length === 0 ? (
                <p className="mt-1.5 text-xs text-ink-muted">—</p>
              ) : (
                <ul className="mt-1.5 space-y-1.5">
                  {month.entries.map((entry) => (
                    <li key={entry.person.id}>
                      <Link
                        href={`/people/${entry.person.id}`}
                        className="flex items-baseline gap-3 rounded-lg text-sm hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral"
                      >
                        <span className="w-6 shrink-0 text-xs tabular-nums text-ink-muted">
                          {entry.day}
                        </span>
                        <span className="truncate">{nameOf(entry.person)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
