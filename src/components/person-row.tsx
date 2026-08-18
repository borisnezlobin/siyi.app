"use client";

import { CaretRight, Clock } from "@phosphor-icons/react";
import Link from "next/link";
import { Avatar } from "@/components/avatar";
import { dueDateLabelFromDaysAway, lastSeenLabel } from "@/lib/relative-time";
import { getContactReminderState } from "@/lib/reminders";
import { personPath } from "@/lib/slug";
import type { Person } from "@/lib/types";

export function PersonRow({ person }: { person: Person }) {
  const reminder = getContactReminderState(person);
  const href = personPath(person);

  /**
   * No prefetch handlers here on purpose.
   *
   * `Link` already warms on the first sign of intent, on both pointers and
   * touch (`onMouseEnter` and `onTouchStart` in next/link), and at the same
   * depth a bare `router.prefetch(href)` asks for — as far as the loading
   * skeleton, not the whole profile. The handlers this row used to carry were
   * doing the work twice and reading as though they did something more.
   */

  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-1 py-3 transition-colors hover:bg-white active:bg-mist focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral sm:px-2"
    >
      <Avatar name={person.fullName} imageUrl={person.profilePhotoUrl} size="md" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-bold tracking-[-0.015em] sm:text-base">
          {person.preferredName ?? person.fullName}
        </span>
        <span className="mt-1 flex items-center gap-1.5 text-[11px] text-ink-muted sm:text-xs">
          <Clock size={13} aria-hidden="true" />
          {lastSeenLabel(person.lastInteractionAt)}
        </span>
        <span className="mt-1.5 block truncate text-xs text-ink/72">
          {person.generalNotes ?? person.major ?? "Add something worth remembering"}
        </span>
        {reminder?.isOverdue ? (
          <span className="mt-2 inline-flex rounded-full bg-coral-soft px-2 py-1 text-[10px] font-semibold text-coral-strong">
            {dueDateLabelFromDaysAway(-reminder.overdueDays)}
          </span>
        ) : null}
      </span>
      <CaretRight size={16} className="shrink-0 text-ink-muted" aria-hidden="true" />
    </Link>
  );
}
