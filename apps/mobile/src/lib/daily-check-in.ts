import type { FilterablePerson } from "@/lib/people-filters";

// Deliberately not imported from people-filters: that module pulls in the whole
// college table, and this screen only needs a name to sort by.
function displayNameOf(person: { fullName: string; preferredName?: string | null }) {
  return person.preferredName?.trim() || person.fullName;
}

export type CheckInPerson = FilterablePerson & {
  id: string;
  lastInteractionAt?: string | null;
  firstMetAt?: string;
  relationshipStrength?: number;
  status?: string;
};

const dayInMilliseconds = 86_400_000;

function lastSeenAt(person: CheckInPerson) {
  const stamp = person.lastInteractionAt ?? person.firstMetAt;
  const parsed = stamp ? new Date(stamp).getTime() : Number.NaN;
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function loggedToday(person: CheckInPerson, today = new Date()) {
  if (!person.lastInteractionAt) return false;
  const seen = new Date(person.lastInteractionAt);
  return (
    seen.getFullYear() === today.getFullYear() &&
    seen.getMonth() === today.getMonth() &&
    seen.getDate() === today.getDate()
  );
}

/**
 * Who to offer in "who did you talk to today?", best guess first.
 *
 * The people you actually see are the ones you saw recently, so recency leads.
 * Anyone already logged today drops out — the point of the question is what is
 * still missing. Someone brand new with no history sorts by when you met them,
 * which is the only signal they have.
 */
export function checkInCandidates<T extends CheckInPerson>(
  people: T[],
  today = new Date(),
  limit = 12
): T[] {
  return people
    .filter((person) => person.status !== "archived")
    .filter((person) => !loggedToday(person, today))
    .sort((left, right) => {
      const gap = lastSeenAt(right) - lastSeenAt(left);
      if (gap !== 0) return gap;
      return displayNameOf(left).localeCompare(displayNameOf(right));
    })
    .slice(0, limit);
}

/** How long since you logged anything with them, for the subtitle on each row. */
export function lastSeenLabel(person: CheckInPerson, today = new Date()) {
  if (!person.lastInteractionAt) return "Not logged yet";
  const days = Math.floor((today.getTime() - lastSeenAt(person)) / dayInMilliseconds);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 14) return "Last week";
  if (days < 60) return `${Math.round(days / 7)} weeks ago`;
  return `${Math.round(days / 30)} months ago`;
}

/**
 * Whether to ask at all today. Nothing to ask about with an empty circle, and
 * once everyone plausible is logged the question is just noise.
 */
export function shouldAskToday(people: CheckInPerson[], today = new Date()) {
  return checkInCandidates(people, today).length > 0;
}
