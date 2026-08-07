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

/**
 * A day here ends at 4am, not midnight. Someone logging the people they saw at a
 * party at 1am means last night, and would be baffled to find the list already
 * cleared.
 */
export const dayStartsAtHour = 4;

export function startOfCheckInDay(now = new Date()) {
  const start = new Date(now);
  start.setHours(dayStartsAtHour, 0, 0, 0);
  if (now.getHours() < dayStartsAtHour) {
    start.setDate(start.getDate() - 1);
  }
  return start;
}

function lastSeenAt(person: CheckInPerson) {
  const stamp = person.lastInteractionAt ?? person.firstMetAt;
  const parsed = stamp ? new Date(stamp).getTime() : Number.NaN;
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function loggedToday(person: CheckInPerson, today = new Date()) {
  if (!person.lastInteractionAt) return false;
  return new Date(person.lastInteractionAt).getTime() >= startOfCheckInDay(today).getTime();
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
  // Anyone already logged today stays on the list, ticked. Coming back at 9pm
  // should show the three people from lunch still selected, not an empty page
  // that makes it look like nothing was saved.
  const alreadyLogged = people.filter(
    (person) => person.status !== "archived" && loggedToday(person, today)
  );
  const rest = people
    .filter((person) => person.status !== "archived")
    .filter((person) => !loggedToday(person, today))
    .sort((left, right) => {
      const gap = lastSeenAt(right) - lastSeenAt(left);
      if (gap !== 0) return gap;
      return displayNameOf(left).localeCompare(displayNameOf(right));
    })
    .slice(0, limit);

  return [
    ...alreadyLogged.sort((left, right) =>
      displayNameOf(left).localeCompare(displayNameOf(right))
    ),
    ...rest,
  ];
}

/** Who the page opens with already ticked: everyone logged since 4am. */
export function alreadyLoggedIds(people: CheckInPerson[], today = new Date()) {
  return people.filter((person) => loggedToday(person, today)).map((person) => person.id);
}

/**
 * Whether to ask at all today. Nothing to ask about with an empty circle, and
 * once everyone plausible is logged the question is just noise.
 */
export function shouldAskToday(people: CheckInPerson[], today = new Date()) {
  return checkInCandidates(people, today).some(
    (person) => !loggedToday(person, today)
  );
}
