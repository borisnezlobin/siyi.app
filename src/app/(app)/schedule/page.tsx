import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import {
  formatTimeRange,
  scheduleForDay,
  weekdays,
  type WeekdayKey,
} from "@/lib/classes";
import { getClassesByPerson } from "@/lib/classes-server";
import { getPeople } from "@/lib/data";

export const metadata: Metadata = {
  title: "Schedule",
};

export const dynamic = "force-dynamic";

const todayKey: WeekdayKey[] = ["Su", "M", "Tu", "W", "Th", "F", "Sa"];

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ day?: string }>;
}) {
  const requested = (await searchParams).day;
  const day =
    weekdays.find((entry) => entry.key === requested)?.key ??
    todayKey[new Date().getDay()];

  const [people, classesByPerson] = await Promise.all([
    getPeople(),
    getClassesByPerson(),
  ]);

  const withClasses = people
    .filter((person) => person.status !== "archived")
    .map((person) => ({
      id: person.id,
      name: person.preferredName || person.fullName,
      classes: classesByPerson.get(person.id) ?? [],
    }));

  const schedule = scheduleForDay(withClasses, day);
  const anyClasses = withClasses.some((person) => person.classes.length > 0);

  return (
    <div className="mx-auto w-full max-w-3xl px-5 pb-24 pt-8">
      <PageHeader
        eyebrow="Your circle"
        title="Where everyone is"
        description="Built from the classes you have written down against each person."
      />

      <div className="mt-6 flex flex-wrap gap-2" role="tablist" aria-label="Day">
        {weekdays.map((entry) => (
          <Link
            key={entry.key}
            href={`/schedule?day=${entry.key}`}
            role="tab"
            aria-selected={day === entry.key}
            className={
              day === entry.key
                ? "rounded-xl bg-ink px-4 py-2 text-sm font-semibold text-white"
                : "rounded-xl bg-ink/[0.06] px-4 py-2 text-sm font-semibold text-ink-muted hover:bg-ink/10"
            }
          >
            {entry.label}
          </Link>
        ))}
      </div>

      {!anyClasses ? (
        <div className="mt-8 rounded-3xl bg-white px-6 py-14 text-center">
          <p className="font-display text-2xl">No classes saved yet</p>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-ink-muted">
            Add a class on someone&apos;s profile and they will show up here. You
            can then search for everyone in a course, or with a professor.
          </p>
        </div>
      ) : schedule.length === 0 ? (
        <p className="mt-8 text-sm text-ink-muted">
          Nobody has a class on this day.
        </p>
      ) : (
        <ul className="mt-6 space-y-2">
          {schedule.map((slot) => (
            <li key={`${slot.personId}-${slot.entry.id}`}>
              <Link
                href={`/people/${slot.personId}`}
                className="flex items-center gap-4 rounded-2xl bg-white p-4 transition-colors hover:bg-mist/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral"
              >
                <span className="w-24 shrink-0 text-xs font-semibold tabular-nums text-ink-muted">
                  {formatTimeRange(slot.entry.startsAt, slot.entry.endsAt)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">
                    {slot.personName}
                  </span>
                  <span className="block truncate text-xs text-ink-muted">
                    {slot.entry.courseCode}
                    {slot.entry.professor ? ` · ${slot.entry.professor}` : ""}
                    {slot.entry.location ? ` · ${slot.entry.location}` : ""}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
