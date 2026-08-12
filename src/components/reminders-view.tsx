"use client";

import { CalendarBlank, ListBullets } from "@phosphor-icons/react";
import clsx from "clsx";
import { useState } from "react";
import { ReminderBoard } from "@/components/reminder-board";
import { ReminderCalendar } from "@/components/reminder-calendar";
import type { BirthdayPerson, CalendarReminder } from "@/lib/reminder-calendar";
import type { Person, Reminder } from "@/lib/types";
import { reminderPeopleLabel } from "@/lib/reminder-people";

/**
 * The same reminders, two ways round.
 *
 * The list answers "what should I do next"; the calendar answers "what does the
 * month look like", which is also where birthdays belong — they are the other
 * thing with a date on it, and they were only ever visible on their own page.
 */
export function RemindersView({
  reminders,
  people,
  initialQuery = "",
}: {
  reminders: Reminder[];
  people: Person[];
  initialQuery?: string;
}) {
  const [view, setView] = useState<"list" | "calendar">("list");

  const calendarReminders: CalendarReminder[] = reminders.map((reminder) => ({
    id: reminder.id,
    text: reminder.text,
    dueAt: reminder.dueAt,
    completedAt: reminder.completedAt,
    person: reminder.people[0]
      ? {
          id: reminder.people[0].id,
          // The calendar draws one avatar per entry, so it gets the first
          // person and the label carries the rest.
          name: reminderPeopleLabel(reminder.people),
          photoUrl: reminder.people[0].profilePhotoUrl,
        }
      : null,
  }));

  const birthdayPeople: BirthdayPerson[] = people.map((person) => ({
    id: person.id,
    fullName: person.fullName,
    preferredName: person.preferredName,
    profilePhotoUrl: person.profilePhotoUrl,
    birthday: person.birthday,
    status: person.status,
  }));

  return (
    <div>
      <div className="mt-6 flex items-center gap-1">
        {(
          [
            ["list", "List", ListBullets],
            ["calendar", "Calendar", CalendarBlank],
          ] as const
        ).map(([option, label, Icon]) => (
          <button
            key={option}
            type="button"
            onClick={() => setView(option)}
            aria-pressed={view === option}
            className={clsx(
              "inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral",
              view === option
                ? "bg-ink text-white"
                : "text-ink-muted hover:bg-mist hover:text-ink",
            )}
          >
            <Icon size={15} weight={view === option ? "fill" : "regular"} aria-hidden="true" />
            {label}
          </button>
        ))}
      </div>

      {view === "list" ? (
        <ReminderBoard initialReminders={reminders} initialQuery={initialQuery} />
      ) : (
        <ReminderCalendar reminders={calendarReminders} people={birthdayPeople} />
      )}
    </div>
  );
}
