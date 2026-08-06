import { ArrowUpRight, Clock } from "@phosphor-icons/react/dist/ssr";
import { formatDistanceToNowStrict } from "date-fns";
import Link from "next/link";
import { Avatar } from "@/components/avatar";
import { QuickInteractionSheet } from "@/components/quick-interaction-sheet";
import { formatOverdueDuration, getContactReminderState } from "@/lib/reminders";
import type { Person } from "@/lib/types";

type PersonRowProps = {
  person: Person;
  showOverdue?: boolean;
};

export function PersonRow({ person, showOverdue = false }: PersonRowProps) {
  const reminder = getContactReminderState(person);
  const lastInteractionLabel = person.lastInteractionAt
    ? formatDistanceToNowStrict(new Date(person.lastInteractionAt), {
        addSuffix: true,
      })
    : "No updates yet";

  return (
    <article className="relative grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-[1.35rem] bg-white p-3 shadow-card ring-1 ring-black/[0.035] transition-transform hover:-translate-y-0.5 sm:p-4">
      <Link
        href={`/people/${person.id}`}
        className="relative z-0 flex min-w-0 items-center gap-3 overflow-hidden rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral"
      >
        <Avatar
          name={person.fullName}
          imageUrl={person.profilePhotoUrl}
          size="lg"
        />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate text-sm font-bold tracking-[-0.015em] sm:text-base">
              {person.preferredName ?? person.fullName}
            </span>
            <ArrowUpRight
              size={14}
              className="shrink-0 text-ink/25"
              aria-hidden="true"
            />
          </span>
          <span className="mt-1 flex items-center gap-1.5 text-[11px] text-ink-muted sm:text-xs">
            <Clock size={13} aria-hidden="true" />
            {lastInteractionLabel}
          </span>
          <span className="mt-1.5 block truncate text-xs text-ink/72">
            {person.generalNotes ?? person.major ?? "Add something worth remembering"}
          </span>
          {showOverdue && reminder?.isOverdue ? (
            <span className="mt-2 inline-flex rounded-full bg-[#fbe5e0] px-2 py-1 text-[10px] font-semibold text-coral-strong">
              {formatOverdueDuration(reminder.overdueDays)}
            </span>
          ) : null}
        </span>
      </Link>
      <QuickInteractionSheet
        personId={person.id}
        personName={person.preferredName ?? person.fullName}
        compact
      />
    </article>
  );
}
