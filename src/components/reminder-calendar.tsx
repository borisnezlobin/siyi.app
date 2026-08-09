"use client";

import { Cake, CaretLeft, CaretRight } from "@phosphor-icons/react";
import clsx from "clsx";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Avatar } from "@/components/avatar";
import {
  buildCalendarDays,
  calendarScopes,
  calendarTitle,
  countOnDay,
  shiftAnchor,
  weekdayInitials,
  type BirthdayPerson,
  type CalendarDay,
  type CalendarReminder,
  type CalendarScope,
} from "@/lib/reminder-calendar";
import { dueDateLabel } from "@/lib/relative-time";

const scopeLabels: Record<CalendarScope, string> = {
  day: "Day",
  week: "Week",
  month: "Month",
};

/**
 * Reminders and birthdays on a calendar rather than in a list.
 *
 * A month is for seeing where the weight falls; a day is for reading what is
 * actually on it. So the month shows faces and cakes and no words, and the day
 * shows every reminder in full.
 */
export function ReminderCalendar({
  reminders,
  people,
}: {
  reminders: CalendarReminder[];
  people: BirthdayPerson[];
}) {
  const [scope, setScope] = useState<CalendarScope>("month");
  const [anchor, setAnchor] = useState(() => new Date());
  const now = useMemo(() => new Date(), []);

  const days = useMemo(
    () => buildCalendarDays({ scope, anchor, reminders, people, now }),
    [scope, anchor, reminders, people, now],
  );

  return (
    <div className="mt-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setAnchor((current) => shiftAnchor(scope, current, -1))}
            aria-label={`Previous ${scope}`}
            className="grid size-9 place-items-center rounded-full text-ink-muted transition-colors hover:bg-mist hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral"
          >
            <CaretLeft size={16} weight="bold" aria-hidden="true" />
          </button>
          <h2 className="min-w-[9rem] text-center text-sm font-bold">
            {calendarTitle(scope, anchor)}
          </h2>
          <button
            type="button"
            onClick={() => setAnchor((current) => shiftAnchor(scope, current, 1))}
            aria-label={`Next ${scope}`}
            className="grid size-9 place-items-center rounded-full text-ink-muted transition-colors hover:bg-mist hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral"
          >
            <CaretRight size={16} weight="bold" aria-hidden="true" />
          </button>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setAnchor(new Date())}
            className="rounded-full px-3 py-1.5 text-xs font-semibold text-ink-muted transition-colors hover:bg-mist hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral"
          >
            Today
          </button>
          {calendarScopes.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setScope(option)}
              aria-pressed={scope === option}
              className={clsx(
                "rounded-full px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral",
                scope === option
                  ? "bg-ink text-white"
                  : "text-ink-muted hover:bg-mist hover:text-ink",
              )}
            >
              {scopeLabels[option]}
            </button>
          ))}
        </div>
      </div>

      {scope === "month" ? (
        <MonthGrid days={days} />
      ) : (
        <ol className="mt-4 space-y-2">
          {days.map((day) => (
            <DayRow key={day.key} day={day} showWeekday={scope === "week"} />
          ))}
        </ol>
      )}
    </div>
  );
}

/** Everyone on a day, birthdays first, as a stack of faces. */
function facesOn(day: CalendarDay) {
  return [
    ...day.birthdays.map((birthday) => ({
      key: `b-${birthday.personId}`,
      name: birthday.name,
      photoUrl: birthday.photoUrl,
      birthday: true,
      title:
        birthday.turning === null
          ? `${birthday.name}'s birthday`
          : `${birthday.name} turns ${birthday.turning}`,
    })),
    ...day.reminders.map((reminder) => ({
      key: `r-${reminder.id}`,
      name: reminder.person?.name ?? "Someone",
      photoUrl: reminder.person?.photoUrl,
      birthday: false,
      title: reminder.text,
    })),
  ];
}

function MonthGrid({ days }: { days: CalendarDay[] }) {
  return (
    <div className="mt-4">
      <div className="grid grid-cols-7 gap-1">
        {weekdayInitials.map((initial, index) => (
          <div
            key={`${initial}-${index}`}
            aria-hidden="true"
            className="pb-1 text-center text-[11px] font-semibold text-ink-muted"
          >
            {initial}
          </div>
        ))}
        {days.map((day) => (
          <div
            key={day.key}
            className={clsx(
              "min-h-[5.5rem] rounded-2xl p-1.5 transition-colors",
              day.inScope ? "bg-white" : "bg-white/40",
              day.isToday && "ring-2 ring-coral",
            )}
          >
            <div className="flex items-center justify-between px-0.5">
              <span
                className={clsx(
                  "text-[11px] font-semibold tabular-nums",
                  day.isToday
                    ? "text-coral-strong"
                    : day.inScope
                      ? "text-ink"
                      : "text-ink/30",
                )}
              >
                {day.dayOfMonth}
              </span>
              {day.birthdays.length ? (
                <Cake
                  size={12}
                  weight="fill"
                  className="text-coral-strong"
                  aria-label={`${day.birthdays.length} birthday`}
                />
              ) : null}
            </div>

            {/* Faces rather than words: at a month's width the useful question
                is who, and how much is on, not what each one says. Birthdays
                come first and wear a ring. */}
            <div className="mt-1 flex flex-wrap gap-0.5">
              {facesOn(day)
                .slice(0, 3)
                .map((face) => (
                  <span
                    key={face.key}
                    title={face.title}
                    className={clsx(
                      "block rounded-full",
                      face.birthday && "ring-1 ring-coral",
                    )}
                  >
                    <Avatar name={face.name} imageUrl={face.photoUrl} size="xs" />
                  </span>
                ))}
              {countOnDay(day) > 3 ? (
                <span className="self-center pl-0.5 text-[10px] font-semibold text-ink-muted">
                  +{countOnDay(day) - 3}
                </span>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DayRow({ day, showWeekday }: { day: CalendarDay; showWeekday: boolean }) {
  const empty = countOnDay(day) === 0;

  return (
    <li
      className={clsx(
        "rounded-2xl p-4",
        day.isToday ? "bg-white ring-2 ring-coral" : "bg-white",
      )}
    >
      <div className="flex items-baseline gap-2">
        <h3 className="text-sm font-bold">
          {showWeekday
            ? day.date.toLocaleDateString(undefined, { weekday: "long", day: "numeric" })
            : day.date.toLocaleDateString(undefined, {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
        </h3>
        {day.isToday ? (
          <span className="text-[11px] font-semibold text-coral-strong">Today</span>
        ) : null}
      </div>

      {empty ? (
        <p className="mt-1 text-xs text-ink-muted">Nothing on.</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {day.birthdays.map((birthday) => (
            <li key={`birthday-${birthday.personId}`}>
              <Link
                href={`/people/${birthday.personId}`}
                className="flex items-center gap-3 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral"
              >
                <Avatar name={birthday.name} imageUrl={birthday.photoUrl} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 text-sm font-semibold">
                    <Cake
                      size={14}
                      weight="fill"
                      className="text-coral-strong"
                      aria-hidden="true"
                    />
                    {birthday.name}
                  </span>
                  <span className="block text-[11px] text-ink-muted">
                    {birthday.turning === null
                      ? "Birthday"
                      : `Turns ${birthday.turning}`}
                  </span>
                </span>
              </Link>
            </li>
          ))}
          {day.reminders.map((reminder) => (
            <li key={reminder.id} className="flex items-center gap-3">
              <Avatar
                name={reminder.person?.name ?? "Someone"}
                imageUrl={reminder.person?.photoUrl}
                size="sm"
              />
              <span className="min-w-0 flex-1">
                <span
                  className={clsx(
                    "block text-sm font-semibold",
                    reminder.completedAt && "text-ink-muted line-through",
                  )}
                >
                  {reminder.text}
                </span>
                <span className="block text-[11px] text-ink-muted">
                  {reminder.person?.name ?? "Someone"} · {dueDateLabel(reminder.dueAt)}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}
