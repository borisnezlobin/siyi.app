import {
  ArrowRight,
  Cake,
  CheckCircle,
  ClockCountdown,
  Sparkle,
} from "@phosphor-icons/react/dist/ssr";
import {
  differenceInCalendarDays,
  format,
  isAfter,
  isBefore,
  isSameDay,
  startOfDay,
  subDays,
} from "date-fns";
import Link from "next/link";
import { Avatar } from "@/components/avatar";
import { PageHeader } from "@/components/page-header";
import { PersonRow } from "@/components/person-row";
import { getFollowUps, getPeople } from "@/lib/data";
import { getContactReminderState } from "@/lib/reminders";

export const dynamic = "force-dynamic";

export default async function TodayPage() {
  const now = new Date();
  const [people, followUps] = await Promise.all([getPeople(), getFollowUps()]);
  const overduePeople = people
    .filter((person) => getContactReminderState(person, now)?.isOverdue)
    .sort((firstPerson, secondPerson) => {
      const firstReminder = getContactReminderState(firstPerson, now);
      const secondReminder = getContactReminderState(secondPerson, now);
      return (secondReminder?.overdueDays ?? 0) - (firstReminder?.overdueDays ?? 0);
    });
  const upcomingBirthdays = people
    .filter((person) => {
      if (!person.birthday) return false;
      const [, month, day] = person.birthday.split("-").map(Number);
      let nextBirthday = new Date(now.getFullYear(), month - 1, day);
      if (isBefore(nextBirthday, startOfDay(now))) {
        nextBirthday = new Date(now.getFullYear() + 1, month - 1, day);
      }
      return differenceInCalendarDays(nextBirthday, startOfDay(now)) <= 14;
    })
    .sort((firstPerson, secondPerson) => {
      const firstBirthday = firstPerson.birthday?.slice(5) ?? "";
      const secondBirthday = secondPerson.birthday?.slice(5) ?? "";
      return firstBirthday.localeCompare(secondBirthday);
    });
  const openFollowUps = followUps
    .filter(({ completedAt }) => !completedAt)
    .slice(0, 3);
  const recentPeople = people.filter(({ createdAt }) =>
    isAfter(new Date(createdAt), subDays(now, 7)),
  );

  return (
    <div className="mx-auto max-w-[1120px] px-4 py-7 sm:px-7 sm:py-10 lg:px-10 lg:py-12">
      <PageHeader
        eyebrow={format(now, "EEEE, MMMM d")}
        title="Who’s on your mind?"
        description="A few useful nudges, based on what you asked to remember."
        action={
          <Link
            href="/notifications"
            className="grid size-11 shrink-0 place-items-center rounded-full bg-white text-ink shadow-card ring-1 ring-black/[0.035] transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral"
            aria-label="Notification settings"
          >
            <ClockCountdown size={21} aria-hidden="true" />
          </Link>
        }
      />

      <section className="mt-8 overflow-hidden rounded-[1.75rem] bg-ink px-5 py-5 text-white shadow-float sm:px-7 sm:py-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-sun">
              <Sparkle size={15} weight="fill" aria-hidden="true" />
              Today’s short list
            </div>
            <p className="mt-3 max-w-lg font-display text-[1.7rem] leading-[1.05] tracking-[-0.025em]">
              Reach out to one person. The rest can wait.
            </p>
          </div>
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-white/10 font-display text-2xl">
            {overduePeople.length}
          </span>
        </div>
        {overduePeople[0] ? (
          <div className="mt-5 flex items-center gap-3 rounded-2xl bg-white px-3 py-3 text-ink">
            <Avatar
              name={overduePeople[0].fullName}
              imageUrl={overduePeople[0].profilePhotoUrl}
              size="md"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold">
                {overduePeople[0].preferredName ?? overduePeople[0].fullName}
              </p>
              <p className="mt-0.5 truncate text-[11px] text-ink-muted">
                {overduePeople[0].firstMetLocation ?? "Reconnect when it feels right"}
              </p>
            </div>
            <Link
              href={`/people/${overduePeople[0].id}`}
              className="grid size-10 place-items-center rounded-full bg-coral text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral focus-visible:ring-offset-2"
              aria-label={`Open ${overduePeople[0].fullName}`}
            >
              <ArrowRight size={17} weight="bold" aria-hidden="true" />
            </Link>
          </div>
        ) : (
          <p className="mt-4 text-sm text-white/65">
            No one is overdue. You’re all caught up.
          </p>
        )}
      </section>

      <div className="mt-8 grid gap-8 xl:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.65fr)]">
        <section aria-labelledby="overdue-heading">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 id="overdue-heading" className="text-base font-bold">
                Ready for a hello
              </h2>
              <p className="mt-1 text-xs text-ink-muted">
                Based on your reminder rhythm
              </p>
            </div>
            <Link
              href="/people?filter=overdue"
              className="text-xs font-semibold text-coral-strong hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral"
            >
              See everyone
            </Link>
          </div>
          <div className="mt-4 space-y-3">
            {overduePeople.length ? (
              overduePeople.slice(0, 4).map((person) => (
                <PersonRow key={person.id} person={person} showOverdue />
              ))
            ) : (
              <div className="rounded-3xl bg-white p-6 text-sm text-ink-muted shadow-card ring-1 ring-black/[0.035]">
                Your reminder list is clear. New conversations will appear here
                when their next check-in is due.
              </div>
            )}
          </div>
        </section>

        <div className="space-y-8">
          <section aria-labelledby="birthdays-heading">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 id="birthdays-heading" className="text-base font-bold">
                  Birthdays soon
                </h2>
                <p className="mt-1 text-xs text-ink-muted">The next 14 days</p>
              </div>
              <Cake size={21} className="text-coral" aria-hidden="true" />
            </div>
            <div className="mt-4 rounded-[1.5rem] bg-white p-2 shadow-card ring-1 ring-black/[0.035]">
              {upcomingBirthdays.length ? (
                upcomingBirthdays.map((person) => {
                  const birthday = new Date(`${person.birthday}T12:00:00`);
                  const birthdayThisYear = new Date(
                    now.getFullYear(),
                    birthday.getMonth(),
                    birthday.getDate(),
                  );
                  const nextBirthday = isBefore(birthdayThisYear, startOfDay(now))
                    ? new Date(
                        now.getFullYear() + 1,
                        birthday.getMonth(),
                        birthday.getDate(),
                      )
                    : birthdayThisYear;
                  const daysAway = differenceInCalendarDays(
                    nextBirthday,
                    startOfDay(now),
                  );

                  return (
                    <Link
                      key={person.id}
                      href={`/people/${person.id}`}
                      className="flex items-center gap-3 rounded-2xl px-2.5 py-3 transition-colors hover:bg-porcelain focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral"
                    >
                      <Avatar
                        name={person.fullName}
                        imageUrl={person.profilePhotoUrl}
                        size="sm"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">
                          {person.preferredName ?? person.fullName}
                        </span>
                        <span className="mt-0.5 block text-[11px] text-ink-muted">
                          {isSameDay(nextBirthday, now)
                            ? "Today"
                            : daysAway === 1
                              ? "Tomorrow"
                              : `In ${daysAway} days`}
                        </span>
                      </span>
                      <span className="rounded-full bg-[#fff5d8] px-2 py-1 text-[10px] font-semibold text-[#705513]">
                        {format(nextBirthday, "MMM d")}
                      </span>
                    </Link>
                  );
                })
              ) : (
                <p className="px-3 py-4 text-sm text-ink-muted">
                  No birthdays in the next two weeks.
                </p>
              )}
            </div>
          </section>

          <section aria-labelledby="follow-ups-heading">
            <div className="flex items-end justify-between gap-4">
              <div>
                <h2 id="follow-ups-heading" className="text-base font-bold">
                  Loose ends
                </h2>
                <p className="mt-1 text-xs text-ink-muted">Things you meant to do</p>
              </div>
              <Link
                href="/follow-ups"
                className="text-xs font-semibold text-coral-strong hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral"
              >
                Open list
              </Link>
            </div>
            <div className="mt-4 space-y-2">
              {openFollowUps.map((followUp) => (
                <Link
                  key={followUp.id}
                  href={`/people/${followUp.personId}`}
                  className="flex items-center gap-3 rounded-2xl bg-white px-3 py-3 shadow-card ring-1 ring-black/[0.035] transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral"
                >
                  <CheckCircle size={20} className="shrink-0 text-sage-strong" aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-semibold">
                      {followUp.text}
                    </span>
                    <span className="mt-0.5 block text-[10px] text-ink-muted">
                      {followUp.person?.preferredName ?? followUp.person?.fullName}
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          </section>
        </div>
      </div>

      {recentPeople.length ? (
        <section className="mt-9" aria-labelledby="new-people-heading">
          <h2 id="new-people-heading" className="text-base font-bold">
            Just met
          </h2>
          <p className="mt-1 text-xs text-ink-muted">Added in the last 7 days</p>
          <div className="mt-4 flex gap-3 overflow-x-auto pb-2">
            {recentPeople.map((person) => (
              <Link
                key={person.id}
                href={`/people/${person.id}`}
                className="flex w-36 shrink-0 flex-col items-center rounded-3xl bg-white px-3 py-5 text-center shadow-card ring-1 ring-black/[0.035] transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral"
              >
                <Avatar
                  name={person.fullName}
                  imageUrl={person.profilePhotoUrl}
                  size="lg"
                />
                <span className="mt-3 truncate text-sm font-bold">
                  {person.preferredName ?? person.fullName}
                </span>
                <span className="mt-1 line-clamp-2 text-[10px] leading-4 text-ink-muted">
                  {person.firstMetLocation}
                </span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
