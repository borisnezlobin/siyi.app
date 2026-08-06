import {
  Cake,
  ClockCountdown,
  UsersThree,
} from "@phosphor-icons/react/dist/ssr";
import {
  differenceInCalendarDays,
  format,
  formatDistanceToNowStrict,
  isAfter,
  isBefore,
  startOfDay,
  subDays,
} from "date-fns";
import Link from "next/link";
import { Avatar } from "@/components/avatar";
import { PageHeader } from "@/components/page-header";
import { QuickInteractionSheet } from "@/components/quick-interaction-sheet";
import { getFollowUps, getPeople } from "@/lib/data";
import { getContactReminderState } from "@/lib/reminders";
import type { Person } from "@/lib/types";

export const dynamic = "force-dynamic";

type TimeSensitiveItem = {
  key: string;
  kind: "follow-up" | "birthday" | "check-in";
  status: "overdue" | "today" | "upcoming";
  dueAt: Date;
  href: string;
  title: string;
  personName: string;
  dueLabel: string;
};

function getNextBirthday(birthday: string, now: Date) {
  const [, month, day] = birthday.split("-").map(Number);
  let nextBirthday = new Date(now.getFullYear(), month - 1, day);

  if (isBefore(nextBirthday, startOfDay(now))) {
    nextBirthday = new Date(now.getFullYear() + 1, month - 1, day);
  }

  return nextBirthday;
}

function getDailyRotationScore(personId: string, dateKey: string) {
  let score = 2166136261;

  for (const character of `${dateKey}:${personId}`) {
    score ^= character.charCodeAt(0);
    score = Math.imul(score, 16777619);
  }

  return score >>> 0;
}

function getDisplayName(person: Person) {
  return person.preferredName ?? person.fullName;
}

export default async function TodayPage() {
  const now = new Date();
  const today = startOfDay(now);
  const [people, followUps] = await Promise.all([getPeople(), getFollowUps()]);
  const timeSensitiveItems: TimeSensitiveItem[] = [];

  for (const followUp of followUps.filter(({ completedAt }) => !completedAt)) {
    const dueAt = startOfDay(new Date(followUp.dueAt));
    const daysFromToday = differenceInCalendarDays(dueAt, today);
    const status =
      daysFromToday < 0
        ? "overdue"
        : daysFromToday === 0
          ? "today"
          : "upcoming";

    timeSensitiveItems.push({
      key: `follow-up-${followUp.id}`,
      kind: "follow-up",
      status,
      dueAt,
      href: `/follow-ups?person=${followUp.personId}`,
      title: followUp.text,
      personName:
        followUp.person?.preferredName ??
        followUp.person?.fullName ??
        "Follow-up",
      dueLabel:
        status === "overdue"
          ? `${Math.abs(daysFromToday)} ${
              Math.abs(daysFromToday) === 1 ? "day" : "days"
            } overdue`
          : status === "today"
            ? "Due today"
            : daysFromToday === 1
              ? "Due tomorrow"
              : `Due ${format(dueAt, "MMM d")}`,
    });
  }

  for (const person of people) {
    const reminder = getContactReminderState(person, now);
    if (!reminder?.isOverdue) continue;

    timeSensitiveItems.push({
      key: `check-in-${person.id}`,
      kind: "check-in",
      status: "overdue",
      dueAt: reminder.dueAt,
      href: `/people/${person.id}`,
      title: `Check in with ${getDisplayName(person)}`,
      personName: person.firstMetLocation ?? "Contact reminder",
      dueLabel: `${reminder.overdueDays} ${
        reminder.overdueDays === 1 ? "day" : "days"
      } past your reminder`,
    });
  }

  for (const person of people) {
    if (!person.birthday) continue;
    const nextBirthday = getNextBirthday(person.birthday, now);
    const daysAway = differenceInCalendarDays(nextBirthday, today);
    if (daysAway > 14) continue;

    timeSensitiveItems.push({
      key: `birthday-${person.id}`,
      kind: "birthday",
      status: daysAway === 0 ? "today" : "upcoming",
      dueAt: nextBirthday,
      href: `/people/${person.id}`,
      title: `${getDisplayName(person)}’s birthday`,
      personName: "Birthday",
      dueLabel:
        daysAway === 0
          ? "Today"
          : daysAway === 1
            ? "Tomorrow"
            : `In ${daysAway} days`,
    });
  }

  const statusOrder = { overdue: 0, today: 1, upcoming: 2 };
  timeSensitiveItems.sort(
    (firstItem, secondItem) =>
      statusOrder[firstItem.status] - statusOrder[secondItem.status] ||
      firstItem.dueAt.getTime() - secondItem.dueAt.getTime(),
  );

  const urgentPersonIds = new Set(
    timeSensitiveItems
      .filter(({ kind }) => kind === "check-in")
      .map(({ key }) => key.replace("check-in-", "")),
  );
  const dateKey = format(now, "yyyy-MM-dd");
  const checkInPeople = people
    .filter(
      (person) =>
        person.status === "active" &&
        !urgentPersonIds.has(person.id) &&
        !isAfter(new Date(person.createdAt), subDays(now, 7)),
    )
    .sort(
      (firstPerson, secondPerson) =>
        getDailyRotationScore(firstPerson.id, dateKey) -
        getDailyRotationScore(secondPerson.id, dateKey),
    )
    .slice(0, 3);
  const recentPeople = people.filter(({ createdAt }) =>
    isAfter(new Date(createdAt), subDays(now, 7)),
  );

  return (
    <div className="mx-auto max-w-[980px] px-4 py-7 sm:px-7 sm:py-10 lg:px-10 lg:py-12">
      <PageHeader
        eyebrow={format(now, "EEEE, MMMM d")}
        title="What needs your attention?"
        description="Dates and promises first. Everything else can stay quiet."
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

      <section className="mt-8" aria-labelledby="time-sensitive-heading">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 id="time-sensitive-heading" className="text-base font-bold">
              Time-sensitive
            </h2>
            <p className="mt-1 text-xs text-ink-muted">
              Overdue first, then what’s coming up
            </p>
          </div>
          <Link
            href="/follow-ups"
            className="text-xs font-semibold text-coral-strong hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral"
          >
            All follow-ups
          </Link>
        </div>

        <div className="mt-4 overflow-hidden rounded-[1.75rem] bg-white p-2 shadow-card ring-1 ring-black/[0.035]">
          {timeSensitiveItems.length ? (
            timeSensitiveItems.slice(0, 7).map((item, index) => (
              <Link
                key={item.key}
                href={item.href}
                className="group grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-[1.25rem] px-3 py-3.5 transition-colors hover:bg-porcelain focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral"
              >
                <span
                  className={`
                    grid size-10 place-items-center rounded-full
                    ${
                      item.status === "overdue"
                        ? "bg-[#fbe5e0] text-coral-strong"
                        : item.status === "today"
                          ? "bg-[#fff5d8] text-[#705513]"
                          : "bg-sage text-sage-strong"
                    }
                  `}
                >
                  {item.kind === "follow-up" ? (
                    <ClockCountdown size={19} weight="fill" aria-hidden="true" />
                  ) : item.kind === "birthday" ? (
                    <Cake size={19} weight="fill" aria-hidden="true" />
                  ) : (
                    <UsersThree size={19} weight="fill" aria-hidden="true" />
                  )}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">
                    {item.title}
                  </span>
                  <span className="mt-0.5 block truncate text-[11px] text-ink-muted">
                    {item.personName}
                  </span>
                </span>
                <span
                  className={`
                    max-w-24 shrink-0 rounded-full px-2.5 py-1.5 text-right text-[10px] font-semibold leading-4
                    ${
                      item.status === "overdue"
                        ? "bg-[#fbe5e0] text-coral-strong"
                        : item.status === "today"
                          ? "bg-[#fff5d8] text-[#705513]"
                          : "bg-sage text-sage-strong"
                    }
                  `}
                >
                  {item.dueLabel}
                </span>
                {index < Math.min(timeSensitiveItems.length, 7) - 1 ? (
                  <span
                    className="col-start-2 col-end-4 -mb-3.5 h-px bg-ink/[0.055]"
                    aria-hidden="true"
                  />
                ) : null}
              </Link>
            ))
          ) : (
            <div className="px-5 py-8 text-center">
              <span className="mx-auto grid size-11 place-items-center rounded-full bg-sage text-sage-strong">
                <ClockCountdown size={21} weight="fill" aria-hidden="true" />
              </span>
              <p className="mt-3 text-sm font-semibold">Nothing has a deadline.</p>
              <p className="mt-1 text-xs text-ink-muted">
                Follow-ups and birthdays will appear here.
              </p>
            </div>
          )}
        </div>
      </section>

      {checkInPeople.length ? (
        <section className="mt-9" aria-labelledby="check-in-heading">
          <h2 id="check-in-heading" className="text-base font-bold">
            A few people to check in on
          </h2>
          <p className="mt-1 text-xs text-ink-muted">
            A small rotating selection—not another to-do list
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {checkInPeople.map((person) => {
              const lastContactAt = new Date(
                person.lastInteractionAt ?? person.firstMetAt,
              );

              return (
                <article
                  key={person.id}
                  className="flex items-center gap-3 rounded-[1.4rem] bg-ink p-3 text-white shadow-card"
                >
                  <Link
                    href={`/people/${person.id}`}
                    className="flex min-w-0 flex-1 items-center gap-3 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sun"
                  >
                    <Avatar
                      name={person.fullName}
                      imageUrl={person.profilePhotoUrl}
                      size="md"
                    />
                    <span className="min-w-0">
                      <span className="block text-xs leading-5 text-white/65">
                        Have you checked in with
                      </span>
                      <span className="block truncate text-sm font-bold">
                        {getDisplayName(person)} recently?
                      </span>
                      <span className="mt-1 block truncate text-[10px] text-white/48">
                        Last logged{" "}
                        {formatDistanceToNowStrict(lastContactAt, {
                          addSuffix: true,
                        })}
                      </span>
                    </span>
                  </Link>
                  <QuickInteractionSheet
                    personId={person.id}
                    personName={getDisplayName(person)}
                    compact
                  />
                </article>
              );
            })}
          </div>
        </section>
      ) : null}

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
                  {getDisplayName(person)}
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
