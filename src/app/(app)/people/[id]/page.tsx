import {
  ArrowLeft,
  ArrowSquareOut,
  At,
  Cake,
  CalendarBlank,
  ChatCircleDots,
  EnvelopeSimple,
  GraduationCap,
  HouseLine,
  MapPin,
  NotePencil,
  PencilSimple,
  Phone,
  Tag as TagIcon,
} from "@phosphor-icons/react/dist/ssr";
import { format, formatDistanceToNowStrict } from "date-fns";
import type { Metadata } from "next";
import Link from "next/link";
import { ArchivePersonButton } from "@/components/archive-person-button";
import { SharePersonButton } from "@/components/share-person-button";
import { Avatar } from "@/components/avatar";
import { QuickCaptureTrigger } from "@/components/quick-capture-hub";
import { QuickInteractionSheet } from "@/components/quick-interaction-sheet";
import {
  getFollowUps,
  getInteractions,
  getPerson,
  getPersonUpdates,
} from "@/lib/data";
import { relationshipLabelFor } from "@/lib/relationship-labels";
import { getContactReminderState } from "@/lib/reminders";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const person = await getPerson(id);
  return { title: person.fullName };
}

function interactionLabel(type: string) {
  return (
    {
      met: "Met",
      texted: "Texted",
      called: "Called",
      coffee: "Coffee",
      meal: "Shared a meal",
      party: "Party",
      class: "Class",
      event: "Event",
      other: "Other",
    }[type] ?? type
  );
}

export default async function PersonDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [person, interactions, personUpdates, allFollowUps] = await Promise.all([
    getPerson(id),
    getInteractions(id),
    getPersonUpdates(id),
    getFollowUps(),
  ]);

  // Updates written on the phone and interactions logged here share one
  // timeline. An interaction created by an update would otherwise show twice.
  const updateEntries = personUpdates.map((update) => ({
    id: `update-${update.id}`,
    at: update.recordedAt,
    title: update.interactionLabel || "Update",
    body: update.text,
  }));
  const interactionEntries = interactions
    .filter((interaction) => !interaction.sourceUpdateId)
    .map((interaction) => ({
      id: `interaction-${interaction.id}`,
      at: interaction.occurredAt,
      title: interactionLabel(interaction.type),
      body: interaction.note,
    }));
  const timeline = [...updateEntries, ...interactionEntries].sort(
    (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime(),
  );
  const openFollowUps = allFollowUps.filter(
    (followUp) => followUp.personId === id && !followUp.completedAt,
  );
  const reminder = getContactReminderState(person);
  const displayName = person.preferredName ?? person.fullName;
  const lastInteractionLabel = person.lastInteractionAt
    ? formatDistanceToNowStrict(new Date(person.lastInteractionAt), {
        addSuffix: true,
      })
    : "No updates yet";

  const facts = [
    person.major
      ? { label: "Major", value: person.major, icon: GraduationCap }
      : null,
    person.graduationYear
      ? { label: "Class", value: String(person.graduationYear), icon: CalendarBlank }
      : null,
    person.dormOrResidence
      ? { label: "Residence", value: person.dormOrResidence, icon: HouseLine }
      : null,
    person.hometown
      ? { label: "Hometown", value: person.hometown, icon: MapPin }
      : null,
    person.birthday
      ? {
          label: "Birthday",
          value: format(new Date(`${person.birthday}T12:00:00`), "MMMM d"),
          icon: Cake,
        }
      : null,
    person.firstMetLocation
      ? { label: "First met", value: person.firstMetLocation, icon: MapPin }
      : null,
  ].filter(Boolean);

  return (
    <div className="mx-auto max-w-[980px] px-4 py-5 sm:px-7 sm:py-9 lg:px-10 lg:py-12">
      <div className="flex items-center justify-between">
        <Link
          href="/people"
          className="inline-flex items-center gap-2 rounded-xl px-2 py-2 text-xs font-semibold text-ink-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral"
        >
          <ArrowLeft size={17} aria-hidden="true" />
          People
        </Link>
        <div className="flex items-center gap-2">
          <Link
            href={`/people/${person.id}/edit`}
            className="inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2.5 text-xs font-semibold text-ink shadow-card ring-1 ring-black/[0.035] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral"
          >
            <PencilSimple size={16} aria-hidden="true" />
            Edit
          </Link>
          <SharePersonButton person={person} />
          <ArchivePersonButton personId={person.id} personName={displayName} />
        </div>
      </div>

      <section className="relative mt-4 overflow-hidden rounded-[2rem] bg-ink px-5 pb-6 pt-7 text-white shadow-float sm:px-8 sm:pb-8 sm:pt-9">
        <div
          className="absolute right-[-3rem] top-[-4rem] size-44 rounded-full bg-sage/10"
          aria-hidden="true"
        />
        <div className="relative flex flex-col items-center text-center sm:flex-row sm:items-end sm:text-left">
          <Avatar
            name={person.fullName}
            imageUrl={person.profilePhotoUrl}
            size="hero"
            className="ring-4 ring-white/10"
          />
          <div className="mt-5 min-w-0 flex-1 sm:mb-2 sm:ml-7 sm:mt-0">
            <p className="text-xs font-semibold text-sun">
              {lastInteractionLabel}
            </p>
            <h1 className="mt-2 font-display text-[2.75rem] leading-[0.9] tracking-[-0.04em] sm:text-6xl">
              {displayName}
            </h1>
            {person.preferredName && person.preferredName !== person.fullName ? (
              <p className="mt-2 text-xs text-white/55">{person.fullName}</p>
            ) : null}
            <div className="mt-4 flex flex-wrap justify-center gap-2 sm:justify-start">
              {person.tags?.map((tag) => (
                <span
                  key={tag.id}
                  className="rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-medium text-white/78"
                >
                  {tag.name}
                </span>
              ))}
              <span className="rounded-full bg-coral px-3 py-1.5 text-[11px] font-semibold text-white">
                {relationshipLabelFor(person)}
              </span>
            </div>
          </div>
        </div>

        <div className="relative mt-6 grid grid-cols-3 gap-2">
          {person.phoneNumber ? (
            <a
              href={`tel:${person.phoneNumber}`}
              className="flex min-h-14 flex-col items-center justify-center gap-1.5 rounded-2xl bg-white/10 text-[10px] font-semibold transition-colors hover:bg-white/16 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sun"
            >
              <Phone size={20} weight="fill" aria-hidden="true" />
              Call
            </a>
          ) : (
            <span className="flex min-h-14 flex-col items-center justify-center gap-1.5 rounded-2xl bg-white/5 text-[10px] text-white/35">
              <Phone size={20} aria-hidden="true" />
              No phone
            </span>
          )}
          {person.email ? (
            <a
              href={`mailto:${person.email}`}
              className="flex min-h-14 flex-col items-center justify-center gap-1.5 rounded-2xl bg-white/10 text-[10px] font-semibold transition-colors hover:bg-white/16 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sun"
            >
              <EnvelopeSimple size={20} weight="fill" aria-hidden="true" />
              Email
            </a>
          ) : (
            <span className="flex min-h-14 flex-col items-center justify-center gap-1.5 rounded-2xl bg-white/5 text-[10px] text-white/35">
              <EnvelopeSimple size={20} aria-hidden="true" />
              No email
            </span>
          )}
          {person.instagramUsername ? (
            <a
              href={`https://instagram.com/${person.instagramUsername}`}
              target="_blank"
              rel="noreferrer"
              className="flex min-h-14 flex-col items-center justify-center gap-1.5 rounded-2xl bg-white/10 text-[10px] font-semibold transition-colors hover:bg-white/16 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sun"
            >
              <At size={20} weight="bold" aria-hidden="true" />
              Instagram
            </a>
          ) : (
            <span className="flex min-h-14 flex-col items-center justify-center gap-1.5 rounded-2xl bg-white/5 text-[10px] text-white/35">
              <At size={20} aria-hidden="true" />
              No username
            </span>
          )}
        </div>
      </section>

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-5">
          {person.generalNotes ? (
            <section className="rounded-[1.75rem] bg-white p-5 shadow-card ring-1 ring-black/[0.035] sm:p-6">
              <div className="flex items-center gap-2">
                <NotePencil size={18} className="text-coral" aria-hidden="true" />
                <h2 className="text-sm font-bold">What to remember</h2>
              </div>
              <p className="mt-4 text-sm leading-7 text-ink/78">
                {person.generalNotes}
              </p>
            </section>
          ) : null}

          <section className="rounded-[1.75rem] bg-white p-5 shadow-card ring-1 ring-black/[0.035] sm:p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-sm font-bold">Updates</h2>
                <p className="mt-1 text-[11px] text-ink-muted">
                  Most recent first
                </p>
              </div>
              <QuickInteractionSheet
                personId={person.id}
                personName={displayName}
              />
            </div>
            <ol className="mt-5 space-y-5">
              {timeline.length ? (
                timeline.map((entry, index) => (
                  <li key={entry.id} className="relative flex gap-3">
                    {index < timeline.length - 1 ? (
                      <span
                        className="absolute bottom-[-1.25rem] left-[15px] top-8 w-px bg-ink/10"
                        aria-hidden="true"
                      />
                    ) : null}
                    <span className="relative z-10 grid size-8 shrink-0 place-items-center rounded-full bg-sage text-sage-strong">
                      <ChatCircleDots size={15} weight="fill" aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-3">
                        <p className="text-xs font-bold">{entry.title}</p>
                        <time
                          dateTime={entry.at}
                          className="shrink-0 text-[10px] text-ink-muted"
                        >
                          {format(new Date(entry.at), "MMM d, yyyy")}
                        </time>
                      </div>
                      {entry.body ? (
                        <p className="mt-1 text-xs leading-5 text-ink-muted">
                          {entry.body}
                        </p>
                      ) : null}
                    </div>
                  </li>
                ))
              ) : (
                <li className="text-sm text-ink-muted">
                  Add your first update to start the timeline.
                </li>
              )}
            </ol>
          </section>
        </div>

        <aside className="space-y-5">
          <section className="rounded-[1.75rem] bg-white p-5 shadow-card ring-1 ring-black/[0.035]">
            <p className="text-xs font-semibold text-coral-strong">Next reminder</p>
            <p className="mt-1 font-display text-2xl tracking-[-0.025em]">
              {reminder ? format(reminder.dueAt, "MMMM d") : "Paused"}
            </p>
            <p className="mt-2 text-[11px] leading-5 text-ink-muted">
              {reminder
                ? `Every ${reminder.intervalDays} days. Adding an update resets it.`
                : person.remindersEnabled === false
                  ? "Reminders are off for them. Turn them back on when you edit."
                  : "Muted and archived people do not appear in reminders."}
            </p>
          </section>

          <section className="rounded-[1.75rem] bg-white p-5 shadow-card ring-1 ring-black/[0.035]">
            <h2 className="text-sm font-bold">Quick facts</h2>
            <dl className="mt-4 space-y-4">
              {facts.map((fact) => {
                if (!fact) return null;
                const Icon = fact.icon;
                return (
                  <div key={fact.label} className="flex gap-3">
                    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-porcelain text-ink-muted">
                      <Icon size={15} aria-hidden="true" />
                    </span>
                    <div>
                      <dt className="text-[10px] text-ink-muted">{fact.label}</dt>
                      <dd className="mt-0.5 text-xs font-semibold">{fact.value}</dd>
                    </div>
                  </div>
                );
              })}
            </dl>
          </section>

          <section className="rounded-[1.75rem] bg-white p-5 shadow-card ring-1 ring-black/[0.035]">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-bold">Open follow-ups</h2>
              <div className="flex items-center gap-2">
                <QuickCaptureTrigger
                  mode="follow-up"
                  personId={person.id}
                  label={`Add a follow-up for ${displayName}`}
                  compact
                />
                <Link
                  href={`/follow-ups?person=${person.id}`}
                  className="grid size-9 place-items-center rounded-full bg-porcelain text-ink-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral"
                  aria-label="Open all follow-ups"
                >
                  <ArrowSquareOut size={14} aria-hidden="true" />
                </Link>
              </div>
            </div>
            <div className="mt-4 space-y-2">
              {openFollowUps.length ? (
                openFollowUps.map((followUp) => (
                  <div
                    key={followUp.id}
                    className="rounded-2xl bg-porcelain px-3 py-3"
                  >
                    <p className="text-xs font-semibold leading-5">{followUp.text}</p>
                    <p className="mt-1 text-[10px] text-coral-strong">
                      Due {format(new Date(followUp.dueAt), "MMM d")}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-xs leading-5 text-ink-muted">
                  Nothing open. Add a follow-up when something comes up.
                </p>
              )}
            </div>
          </section>

          {person.tags?.length ? (
            <section className="rounded-[1.75rem] bg-white p-5 shadow-card ring-1 ring-black/[0.035]">
              <div className="flex items-center gap-2">
                <TagIcon size={16} className="text-coral" aria-hidden="true" />
                <h2 className="text-sm font-bold">Tags</h2>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {person.tags.map((tag) => (
                  <span
                    key={tag.id}
                    className="rounded-full bg-sage px-3 py-1.5 text-[11px] font-semibold text-sage-strong"
                  >
                    {tag.name}
                  </span>
                ))}
              </div>
            </section>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
