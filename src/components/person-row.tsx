import { CaretRight, Clock } from "@phosphor-icons/react/dist/ssr";
import { formatDistanceToNowStrict } from "date-fns";
import Link from "next/link";
import { Avatar } from "@/components/avatar";
import { QuickInteractionSheet } from "@/components/quick-interaction-sheet";
import { formatOverdueDuration, getContactReminderState } from "@/lib/reminders";
import { personPath } from "@/lib/slug";
import type { Person } from "@/lib/types";

export function PersonRow({ person }: { person: Person }) {
  const reminder = getContactReminderState(person);
  const lastInteractionLabel = person.lastInteractionAt
    ? formatDistanceToNowStrict(new Date(person.lastInteractionAt), {
        addSuffix: true,
      })
    : "No interactions yet";

  return (
    <article className="relative grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-1 py-3 transition-colors hover:bg-white sm:px-2">
      <Link
        href={personPath(person)}
        className="relative z-0 flex min-w-0 items-center gap-3 overflow-hidden rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral"
      >
        <Avatar name={person.fullName} imageUrl={person.profilePhotoUrl} size="lg" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-bold tracking-[-0.015em] sm:text-base">
            {person.preferredName ?? person.fullName}
          </span>
          <span className="mt-1 flex items-center gap-1.5 text-[11px] text-ink-muted sm:text-xs">
            <Clock size={13} aria-hidden="true" />
            {lastInteractionLabel}
          </span>
          <span className="mt-1.5 block truncate text-xs text-ink/72">
            {person.generalNotes ?? person.major ?? "Add something worth remembering"}
          </span>
          {reminder?.isOverdue ? (
            <span className="mt-2 inline-flex rounded-full bg-coral-soft px-2 py-1 text-[10px] font-semibold text-coral-strong">
              {formatOverdueDuration(reminder.overdueDays)}
            </span>
          ) : null}
        </span>
      </Link>
      <span className="flex items-center gap-1">
        <QuickInteractionSheet
          personId={person.id}
          personName={person.preferredName ?? person.fullName}
          compact
        />
        <CaretRight size={16} className="shrink-0 text-ink-muted" aria-hidden="true" />
      </span>
    </article>
  );
}
