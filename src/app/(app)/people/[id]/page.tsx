import { getAllClasses } from "@/lib/classes-server";
import { PersonClasses } from "@/components/person-classes";
import {
  ArrowLeft,
  Buildings,
  Cake,
  CalendarBlank,
  CaretRight,
  ChatCircleDots,
  EnvelopeSimple,
  GraduationCap,
  Handshake,
  HouseLine,
  InstagramLogo,
  MapPin,
  PencilSimple,
  Phone,
} from "@phosphor-icons/react/dist/ssr";
import { format } from "date-fns";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArchivePersonButton } from "@/components/archive-person-button";
import { SharePersonButton } from "@/components/share-person-button";
import { AmbientHeader } from "@/components/ambient-header";
import { Avatar } from "@/components/avatar";
import { QuickCaptureTrigger } from "@/components/quick-capture-hub";
import { CustomTypeIcon } from "@/components/custom-type-icon";
import { UpdateSheet } from "@/components/update-sheet";
import { ageOnDate } from "@/lib/birthday-age";
import { buildPersonTimeline } from "@/lib/person-timeline";
import { contactDraftsOf } from "@/lib/contact-methods";
import { isCustomTypeIconKey } from "@/lib/custom-type-icons";
import {
  getReminders,
  getInteractions,
  getPerson,
  getPersonNoteSections,
  getPersonUpdates,
} from "@/lib/data";
import { relationshipLabelFor } from "@/lib/relationship-labels";
import {
  dueDateLabel,
  lastSeenLabel,
  relativeDateLabel,
} from "@/lib/relative-time";
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

const sectionHeadingClassName = "text-sm font-bold";
const sectionHeaderClassName = "flex flex-wrap items-center justify-between gap-3";
// Every section action reads the same way: a small icon and the words for what
// it does. Nobody has to decode a lone glyph.
const sectionActionClassName =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 py-3 text-xs font-semibold text-ink-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral";

export default async function PersonDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // The uuid keeps resolving forever, for every link shared before slugs
  // existed; it just moves along to the readable URL.
  const person = await getPerson(id);
  if (person.slug && person.slug !== id) redirect(`/people/${person.slug}`);

  // Everything below is keyed by the uuid, not the URL, so a slug visit reads
  // the same rows a uuid visit does.
  const [interactions, personUpdates, allReminders, noteSections, allClasses] =
    await Promise.all([
      getInteractions(person.id),
      getPersonUpdates(person.id),
      getReminders(),
      getPersonNoteSections(person.id),
      getAllClasses(),
    ]);

  const classesByPerson = new Map<string, typeof allClasses>();
  for (const entry of allClasses) {
    const existing = classesByPerson.get(entry.personId);
    if (existing) existing.push(entry);
    else classesByPerson.set(entry.personId, [entry]);
  }

  const timeline = buildPersonTimeline(personUpdates, interactions);
  const openReminders = allReminders.filter(
    (reminder) => reminder.personIds.includes(person.id) && !reminder.completedAt,
  );
  const visibleNoteSections = noteSections.sections.filter((noteSection) =>
    noteSection.body.trim(),
  );
  // The big buttons stay on the primary of each kind. Anything else they gave
  // you sits underneath rather than crowding them.
  const otherWaysToReachThem = contactDraftsOf(person)
    .filter((method) => !method.isPrimary)
    .map((method) => ({
      kind: method.kind,
      value: method.value,
      label: method.label,
      display: method.kind === "instagram" ? `@${method.value}` : method.value,
      href:
        method.kind === "phone"
          ? `tel:${method.value}`
          : method.kind === "email"
            ? `mailto:${method.value}`
            : `https://instagram.com/${method.value}`,
    }));
  const reminder = getContactReminderState(person);
  const displayName = person.preferredName ?? person.fullName;
  const lastInteractionLabel = lastSeenLabel(person.lastInteractionAt);

  const age = ageOnDate(person.birthday);

  const contactActions = [
    person.phoneNumber
      ? { label: "Call", icon: Phone, href: `tel:${person.phoneNumber}` }
      : null,
    person.phoneNumber
      ? { label: "Text", icon: ChatCircleDots, href: `sms:${person.phoneNumber}` }
      : null,
    person.email
      ? { label: "Email", icon: EnvelopeSimple, href: `mailto:${person.email}` }
      : null,
    person.instagramUsername
      ? {
          label: "Instagram",
          icon: InstagramLogo,
          href: `https://instagram.com/${person.instagramUsername}`,
          external: true,
        }
      : null,
  ].filter(Boolean);

  const facts = [
    person.hometown
      ? { label: "Hometown", value: person.hometown, icon: MapPin }
      : null,
    person.university
      ? { label: "University", value: person.university, icon: Buildings }
      : null,
    person.major
      ? { label: "Major", value: person.major, icon: GraduationCap }
      : null,
    person.graduationYear
      ? {
          label: "Graduation year",
          value: String(person.graduationYear),
          icon: CalendarBlank,
        }
      : null,
    person.dormOrResidence
      ? { label: "Residence", value: person.dormOrResidence, icon: HouseLine }
      : null,
    person.birthday
      ? {
          label: "Birthday",
          value: [
            format(new Date(`${person.birthday}T12:00:00`), "MMMM d"),
            age === null ? null : `${age}`,
          ]
            .filter(Boolean)
            .join(" · "),
          icon: Cake,
        }
      : null,
    person.firstMetLocation
      ? { label: "First met", value: person.firstMetLocation, icon: Handshake }
      : null,
  ].filter(Boolean);

  return (
    <div className="relative mx-auto max-w-[760px] px-4 py-5 sm:px-7 sm:py-9 lg:px-10 lg:py-12">
      <AmbientHeader name={person.fullName} imageUrl={person.profilePhotoUrl} />

      {/* Held at the top of the page: on a long profile, going back or reaching
          for edit should not mean scrolling up first. The blur and the negative
          margins let it sit over the glow rather than cutting a band out of it. */}
      <div className="sticky top-0 z-20 -mx-4 -mt-5 flex items-center justify-between px-4 py-3 sm:-mx-7 sm:-mt-9 sm:px-7 lg:-mx-10 lg:-mt-12 lg:px-10">
        {/* The bar reaches the window; its contents stay with the column. The
            negative margins only ever cancelled the page padding, so on a wide
            screen the blur stopped at the column edge and drew a 760px band
            across the middle of the glow. */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-1/2 -z-10 w-screen -translate-x-1/2 bg-porcelain/70 backdrop-blur"
        />
        <Link
          href="/people"
          className="inline-flex items-center gap-2 rounded-full px-2 py-2 text-xs font-semibold text-ink-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral"
        >
          <ArrowLeft size={17} aria-hidden="true" />
          People
        </Link>
        {/* Editing is what people come up here to do, so it is the one that
            says what it is. Archiving is rare and permanent-feeling, so it
            lives at the bottom rather than a thumb's width from Edit. */}
        <div className="flex items-center gap-2">
          <SharePersonButton person={person} />
          <Link
            href={`/people/${person.id}/edit`}
            className="inline-flex h-11 items-center gap-2 rounded-full bg-ink px-4 text-sm font-semibold text-white transition-colors hover:bg-ink/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral focus-visible:ring-offset-2"
          >
            <PencilSimple size={17} aria-hidden="true" />
            Edit
          </Link>
        </div>
      </div>

      <section className="relative mt-6 flex flex-col items-center text-center">
        <Avatar name={person.fullName} imageUrl={person.profilePhotoUrl} size="hero" />
        <h1 className="mt-4 font-display text-[2.75rem] leading-[0.95] tracking-[-0.04em]">
          {displayName}
        </h1>
        {person.preferredName && person.preferredName !== person.fullName ? (
          <p className="mt-1 text-sm text-ink-muted">{person.fullName}</p>
        ) : null}
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <span className="rounded-full bg-coral-soft px-3 py-1.5 text-[11px] font-semibold text-coral-strong">
            {relationshipLabelFor(person)}
          </span>
          {person.tags?.map((tag) => (
            <span
              key={tag.id}
              className="rounded-full bg-mist px-3 py-1.5 text-[11px] font-medium text-ink-muted"
            >
              {tag.name}
            </span>
          ))}
        </div>
      </section>

      {contactActions.length ? (
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {contactActions.map((action) => {
            if (!action) return null;
            const Icon = action.icon;
            return (
              <a
                key={action.label}
                href={action.href}
                {...("external" in action && action.external
                  ? { target: "_blank", rel: "noreferrer" }
                  : {})}
                className="flex min-h-16 min-w-[4.5rem] flex-col items-center justify-center gap-1.5 rounded-2xl bg-white px-3 text-[11px] font-semibold text-ink transition-colors hover:bg-mist focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral"
              >
                <Icon size={22} aria-hidden="true" />
                {action.label}
              </a>
            );
          })}
        </div>
      ) : null}

      {otherWaysToReachThem.length ? (
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          {otherWaysToReachThem.map((method) => (
            <a
              key={`${method.kind}-${method.value}`}
              href={method.href}
              {...(method.kind === "instagram"
                ? { target: "_blank", rel: "noreferrer" }
                : {})}
              className="flex min-h-9 items-center rounded-full bg-white px-3.5 text-xs text-ink-muted transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral"
            >
              {method.label ? `${method.label} · ${method.display}` : method.display}
            </a>
          ))}
        </div>
      ) : null}

      <div className="mt-6 grid grid-cols-2 gap-3">
        <div className="rounded-[1.5rem] bg-white p-4">
          <p className="text-xs text-ink-muted">Last interaction</p>
          <p className="mt-1 text-sm font-bold">{lastInteractionLabel}</p>
        </div>
        <div className="rounded-[1.5rem] bg-white p-4">
          <p className="text-xs text-ink-muted">Next reminder</p>
          <p className="mt-1 text-sm font-bold">
            {reminder ? dueDateLabel(reminder.dueAt) : "Paused"}
          </p>
        </div>
      </div>

      {facts.length ? (
        <section className="mt-8">
          <h2 className={sectionHeadingClassName}>What you know</h2>
          <dl className="mt-3 grid gap-4 sm:grid-cols-2">
            {facts.map((fact) => {
              if (!fact) return null;
              const Icon = fact.icon;
              return (
                <div key={fact.label} className="flex items-start gap-2.5">
                  <Icon
                    size={17}
                    className="mt-0.5 shrink-0 text-ink-muted"
                    aria-hidden="true"
                  />
                  <div className="min-w-0">
                    <dt className="text-xs text-ink-muted">{fact.label}</dt>
                    <dd className="mt-0.5 text-sm font-semibold">{fact.value}</dd>
                  </div>
                </div>
              );
            })}
          </dl>
        </section>
      ) : null}

      <section className="mt-8">
        <h2 className={sectionHeadingClassName}>Classes</h2>
        <div className="mt-3">
          <PersonClasses
            classes={classesByPerson.get(person.id) ?? []}
            knownClasses={allClasses}
            personId={person.id}
          />
        </div>
      </section>

      {person.generalNotes || visibleNoteSections.length ? (
        <section className="mt-8">
          <h2 className={sectionHeadingClassName}>Notes</h2>
          {person.generalNotes ? (
            <p className="mt-3 whitespace-pre-line text-sm leading-7 text-ink/78">
              {person.generalNotes}
            </p>
          ) : null}
          {visibleNoteSections.map((noteSection) => (
            <div key={noteSection.id} className="mt-5">
              <h3 className="text-xs font-bold text-ink-muted">
                {noteSection.heading}
              </h3>
              <p className="mt-1.5 whitespace-pre-line text-sm leading-7 text-ink/78">
                {noteSection.body}
              </p>
            </div>
          ))}
        </section>
      ) : null}

      <section className="mt-8">
        <div className={sectionHeaderClassName}>
          <h2 className={sectionHeadingClassName}>
            Reminders
            <span className="ml-2 font-normal text-ink-muted">
              {openReminders.length} open
            </span>
          </h2>
          <div className="flex items-center gap-1">
            <QuickCaptureTrigger
              mode="reminder"
              personId={person.id}
              label="Add reminder"
              surface="quiet"
            />
            <Link
              href={`/reminders?person=${person.id}`}
              className={sectionActionClassName}
            >
              <CaretRight size={16} weight="fill" aria-hidden="true" />
              See all
            </Link>
          </div>
        </div>
        <div className="mt-2">
          {openReminders.length ? (
            <ul>
              {openReminders.map((openReminder) => (
                <li
                  key={openReminder.id}
                  className="border-t border-ink/[0.08] py-3"
                >
                  <p className="text-sm font-semibold leading-5">
                    {openReminder.text}
                  </p>
                  <p className="mt-1 text-xs text-coral-strong">
                    {dueDateLabel(openReminder.dueAt)}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="border-t border-ink/[0.08] py-4 text-sm text-ink-muted">
              Nothing open. Add a reminder when something comes up.
            </p>
          )}
        </div>
      </section>

      <section className="mt-8">
        <div className={sectionHeaderClassName}>
          <h2 className={sectionHeadingClassName}>
            History
            <span className="ml-2 font-normal text-ink-muted">
              {timeline.length}
            </span>
          </h2>
          <div className="flex items-center gap-1">
            <QuickCaptureTrigger
              mode="interaction"
              personId={person.id}
              label="Log interaction"
              surface="quiet"
            />
            <QuickCaptureTrigger
              mode="update"
              personId={person.id}
              label="Add update"
              surface="quiet"
            />
          </div>
        </div>
        <ol className="mt-2">
          {timeline.length ? (
            timeline.map((entry) => (
              <li key={entry.id} className="flex gap-3 border-t border-ink/[0.08] py-4">
                <span className="mt-0.5 shrink-0 text-ink-muted">
                  <CustomTypeIcon
                    iconKey={isCustomTypeIconKey(entry.icon) ? entry.icon : null}
                  />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-sm font-semibold">{entry.title}</p>
                    <div className="flex shrink-0 items-center gap-1">
                      <time dateTime={entry.at} className="text-[11px] text-ink-muted">
                        {relativeDateLabel(entry.at)}
                      </time>
                      <UpdateSheet personName={displayName} entry={entry.editable} />
                    </div>
                  </div>
                  {entry.body ? (
                    <p className="mt-1 text-sm leading-6 text-ink/78">{entry.body}</p>
                  ) : null}
                </div>
              </li>
            ))
          ) : (
            <li className="border-t border-ink/[0.08] py-5 text-sm text-ink-muted">
              Nothing yet. Log who you saw, or add something you learned.
            </li>
          )}
        </ol>
      </section>

      <section className="mt-10 border-t border-ink/[0.08] pt-6">
        <ArchivePersonButton personId={person.id} personName={displayName} />
      </section>
    </div>
  );
}
