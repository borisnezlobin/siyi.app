import type { Metadata } from "next";
import { Cake } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import {
  birthdayCountdownLabel,
  birthdaysByMonth,
  upcomingBirthdays,
} from "@/lib/birthday-calendar";
import { getPeople } from "@/lib/data";

export const metadata: Metadata = {
  title: "Birthdays",
};

const monthShort = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export default async function BirthdaysPage() {
  const everyone = await getPeople();
  const people = everyone.filter((person) => person.status !== "archived");
  const months = birthdaysByMonth(people);
  const upcoming = upcomingBirthdays(people, new Date(), 120);
  const withBirthday = people.filter((person) => person.birthday).length;
  const currentMonth = new Date().getMonth();

  return (
    <div className="mx-auto w-full max-w-3xl px-5 pb-24 pt-8">
      <PageHeader
        eyebrow="Your circle"
        title="Birthdays"
        description={`${withBirthday} of ${people.length} people have a birthday saved.`}
      />

      {withBirthday === 0 ? (
        <div className="mt-8 rounded-3xl bg-white px-6 py-14 text-center">
          <Cake size={30} className="mx-auto text-ink-muted" aria-hidden="true" />
          <p className="mt-3 font-display text-2xl">No birthdays saved yet</p>
          <p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-ink-muted">
            Add a birthday to someone&apos;s profile and it will show up here.
          </p>
        </div>
      ) : (
        <>
          <section className="mt-8">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
              Coming up
            </h2>
            <ul className="mt-3 space-y-2">
              {upcoming.map((entry) => (
                <li key={entry.person.id}>
                  <Link
                    href={`/people/${entry.person.id}`}
                    className="flex items-center gap-4 rounded-2xl bg-white p-4 transition-colors hover:bg-mist/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral"
                  >
                    <span className="grid min-w-14 place-items-center rounded-xl bg-mist px-3 py-2">
                      <span className="text-[11px] font-semibold uppercase text-ink-muted">
                        {monthShort[entry.month]}
                      </span>
                      <span className="font-display text-xl leading-none">{entry.day}</span>
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold">
                        {entry.person.preferredName || entry.person.fullName}
                      </span>
                      <span className="block text-xs text-ink-muted">
                        {birthdayCountdownLabel(entry.daysAway)}
                        {entry.turningAge ? ` · turning ${entry.turningAge}` : ""}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
              {upcoming.length === 0 ? (
                <li className="text-sm text-ink-muted">
                  Nothing in the next four months — the year below has everyone.
                </li>
              ) : null}
            </ul>
          </section>

          <section className="mt-10">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
              Whole year
            </h2>
            <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {months.map((month) => (
                <div key={month.month} className="rounded-2xl bg-white p-4">
                  <h3
                    className={
                      month.month === currentMonth
                        ? "text-xs font-semibold uppercase tracking-wide text-coral"
                        : "text-xs font-semibold uppercase tracking-wide text-ink-muted"
                    }
                  >
                    {month.label}
                  </h3>
                  {month.entries.length === 0 ? (
                    <p className="mt-2 text-sm text-ink-muted">—</p>
                  ) : (
                    <ul className="mt-2 space-y-1.5">
                      {month.entries.map((entry) => (
                        <li key={entry.person.id}>
                          <Link
                            href={`/people/${entry.person.id}`}
                            className="flex items-baseline gap-3 rounded-lg text-sm hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral"
                          >
                            <span className="w-6 shrink-0 text-xs tabular-nums text-ink-muted">
                              {entry.day}
                            </span>
                            <span className="truncate">
                              {entry.person.preferredName || entry.person.fullName}
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
