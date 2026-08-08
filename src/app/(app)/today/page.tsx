import {
  Bell,
  Cake,
  CaretRight,
  CheckCircle,
  UsersThree,
} from "@phosphor-icons/react/dist/ssr";
import { differenceInCalendarDays, startOfDay } from "date-fns";
import Link from "next/link";
import { Avatar } from "@/components/avatar";
import { CatchUpDialog, CatchUpTrigger } from "@/components/catch-up-dialog";
import { CompleteReminderButton } from "@/components/complete-reminder-button";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { QuickCaptureTrigger } from "@/components/quick-capture-hub";
import { brand } from "@/config/brand";
import { ageAtNextBirthday } from "@/lib/birthday-age";
import { daysUntilBirthday } from "@/lib/birthday-calendar";
import { lastSeenLabel } from "@/lib/relative-time";
import { getPeople, getReminders } from "@/lib/data";
import { getContactReminderState } from "@/lib/reminders";
import {
  agendaCounts,
  agendaLimit,
  buildTodayAgenda,
  pickCheckInSuggestions,
  recentlyMetPeople,
  type AgendaItem,
} from "@/lib/today-agenda";
import type { Person } from "@/lib/types";

export const dynamic = "force-dynamic";

const agendaIcons = {
  reminder: Bell,
  "check-in": UsersThree,
  birthday: Cake,
};

function displayNameOf(person: Person) {
  return person.preferredName ?? person.fullName;
}

function AgendaRow({ item }: { item: AgendaItem }) {
  const Icon = agendaIcons[item.kind];

  return (
    <div className="flex items-center gap-3 py-3.5">
      <Link
        href={`/people/${item.personId}`}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral"
      >
        <Icon
          size={20}
          aria-hidden="true"
          className={
            item.status === "overdue" ? "shrink-0 text-coral-strong" : "shrink-0 text-ink-muted"
          }
        />
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold">
            {item.title}
          </span>
          <span
            className={
              item.status === "overdue"
                ? "mt-0.5 block truncate text-xs text-coral-strong"
                : "mt-0.5 block truncate text-xs text-ink-muted"
            }
          >
            {item.detail}
          </span>
        </span>
      </Link>
      {item.reminderId ? (
        <CompleteReminderButton
          reminderId={item.reminderId}
          label={item.title}
        />
      ) : null}
    </div>
  );
}

export default async function TodayPage() {
  const now = new Date();
  const today = startOfDay(now);
  const [people, reminders] = await Promise.all([getPeople(), getReminders()]);

  const agenda = buildTodayAgenda({
    reminders: reminders
      .filter(({ completedAt }) => !completedAt)
      .map((reminder) => ({
        id: reminder.id,
        personId: reminder.personId,
        text: reminder.text,
        personName:
          reminder.person?.preferredName ??
          reminder.person?.fullName ??
          "Someone",
        daysAway: differenceInCalendarDays(
          startOfDay(new Date(reminder.dueAt)),
          today,
        ),
      })),
    overdueCheckIns: people.flatMap((person) => {
      const state = getContactReminderState(person, now);
      if (!state?.isOverdue) return [];
      return [
        {
          personId: person.id,
          name: displayNameOf(person),
          daysOverdue: state.overdueDays,
        },
      ];
    }),
    birthdays: people.flatMap((person) => {
      if (person.status !== "active") return [];
      const daysAway = daysUntilBirthday(person.birthday, now);
      if (daysAway === null) return [];
      return [
        {
          personId: person.id,
          name: displayNameOf(person),
          daysAway,
          turningAge: ageAtNextBirthday(person.birthday, now),
        },
      ];
    }),
  }, now);
  const counts = agendaCounts(agenda);
  const activePeople = people.filter((person) => person.status === "active");
  const recentlyMet = recentlyMetPeople(people, now);
  const checkInPeople = pickCheckInSuggestions(
    people,
    [
      ...agenda
        .filter((item) => item.kind === "check-in")
        .map((item) => item.personId),
      ...recentlyMet.map((person) => person.id),
    ],
    now,
  );

  return (
    <div className="mx-auto max-w-[980px] px-4 py-7 sm:px-7 sm:py-10 lg:px-10 lg:py-12">
      <PageHeader
        title="Today"
        description="Here’s what needs attention and who might appreciate a hello."
      />

      <Link
        href="/check-in"
        className="mt-9 flex items-center justify-between gap-4 rounded-2xl bg-white p-4 transition-colors hover:bg-mist/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral"
      >
        <span>
          <span className="block text-sm font-bold">
            Who did you talk to today?
          </span>
          <span className="mt-0.5 block text-xs text-ink-muted">
            One pass, one tap each — log everyone you saw.
          </span>
        </span>
        <CaretRight
          size={16}
          weight="bold"
          aria-hidden="true"
          className="shrink-0 text-ink-muted"
        />
      </Link>

      <div className="mt-4 flex items-center gap-4 rounded-3xl bg-white p-5 shadow-card">
        <p className="flex-1">
          <span className="block font-display text-3xl leading-none">
            {counts.needAttention}
          </span>
          <span className="mt-1.5 block text-xs text-ink-muted">
            need attention
          </span>
        </p>
        <span className="h-10 w-px bg-mist" aria-hidden="true" />
        <p className="flex-1">
          <span className="block font-display text-3xl leading-none">
            {counts.comingUp}
          </span>
          <span className="mt-1.5 block text-xs text-ink-muted">coming up</span>
        </p>
      </div>

      <section className="mt-9" aria-labelledby="time-sensitive-heading">
        <h2 id="time-sensitive-heading" className="text-base font-bold">
          Time-sensitive
        </h2>
        <p className="mt-0.5 text-xs text-ink-muted">
          Overdue first, then what’s coming up
        </p>

        <div className="mt-3">
          {agenda.length ? (
            <div className="divide-y divide-ink/[0.055]">
              {agenda.slice(0, agendaLimit).map((item) => (
                <AgendaRow item={item} key={item.key} />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={CheckCircle}
              title="You’re caught up"
              body="Nothing is overdue, and there are no birthdays or reminders in the next two weeks."
            />
          )}
        </div>
      </section>

      {counts.needAttention === 0 && activePeople.length ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-4 rounded-3xl bg-white p-5 shadow-card">
          <div className="min-w-0">
            <p className="text-base font-bold">Have a little room today?</p>
            <p className="mt-0.5 text-xs text-ink-muted">
              {brand.shortName} can pick someone and bring back the context you
              saved.
            </p>
          </div>
          <CatchUpTrigger label="Catch up with someone" />
        </div>
      ) : null}

      {checkInPeople.length ? (
        <section className="mt-9" aria-labelledby="check-in-heading">
          <h2 id="check-in-heading" className="text-base font-bold">
            Have you checked in recently?
          </h2>
          <div className="mt-3 divide-y divide-ink/[0.055] overflow-hidden rounded-3xl bg-white px-4">
            {checkInPeople.map((person) => (
              <div key={person.id} className="flex items-center gap-3 py-3">
                <Link
                  href={`/people/${person.id}`}
                  className="flex min-w-0 flex-1 items-center gap-3 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral"
                >
                  <Avatar
                    name={person.fullName}
                    imageUrl={person.profilePhotoUrl}
                    size="md"
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">
                      {displayNameOf(person)}
                    </span>
                    <span className="mt-0.5 block text-xs text-ink-muted">
                      {lastSeenLabel(person.lastInteractionAt, now)}
                    </span>
                  </span>
                </Link>
                <QuickCaptureTrigger
                  mode="interaction"
                  personId={person.id}
                  label="Log interaction"
                  surface="quiet"
                />
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {recentlyMet.length ? (
        <section className="mt-9" aria-labelledby="new-people-heading">
          <div className="flex items-start justify-between gap-4">
            <h2 id="new-people-heading" className="text-base font-bold">
              New in your circle
            </h2>
            <p className="text-xs text-ink-muted">Past 7 days</p>
          </div>
          <div className="mt-3 divide-y divide-ink/[0.055] overflow-hidden rounded-3xl bg-white px-4">
            {recentlyMet.map((person) => (
              <Link
                key={person.id}
                href={`/people/${person.id}`}
                className="flex items-center gap-3 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral"
              >
                <Avatar
                  name={person.fullName}
                  imageUrl={person.profilePhotoUrl}
                  size="md"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">
                    {displayNameOf(person)}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-ink-muted">
                    {person.firstMetLocation
                      ? `Met at ${person.firstMetLocation}`
                      : "Ready for a first note"}
                  </span>
                </span>
                <CaretRight
                  size={16}
                  aria-hidden="true"
                  className="shrink-0 text-ink-muted"
                />
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {people.length === 0 ? (
        <div className="mt-9">
          <EmptyState
            icon={UsersThree}
            title="Your circle starts here"
            body="Add the next person you meet. The quick form takes only a few seconds."
          />
        </div>
      ) : null}

      <CatchUpDialog people={activePeople} />
    </div>
  );
}
