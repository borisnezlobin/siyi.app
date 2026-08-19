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
 * Everyone, in an order that puts the likely answers at the top: the people you
 * actually see are the ones you saw recently, so recency leads. Someone brand
 * new with no history sorts by when you met them, which is the only signal they
 * have.
 *
 * There is deliberately no cap, and taking one out is what fixed this screen.
 * The list used to be the top two dozen of whoever was NOT yet logged today —
 * a limit applied after a filter that the reader's own taps change. So ticking
 * somebody moved them out of that group, freed a place, and admitted a
 * stranger who had never been on the page; unticking threw that stranger back
 * off; and anybody whose last-seen changed somewhere else pushed the person at
 * the bottom out of the list entirely. Rows appeared, vanished and shifted
 * under the finger, and none of it was the sort order, which is why fixing the
 * sort twice did not help.
 *
 * A roster that cannot change while you read it is worth more here than a short
 * one. There is a search box for a long circle, and nobody is hidden behind a
 * number they cannot see.
 */
export function checkInCandidates<T extends CheckInPerson>(
  people: T[],
  today = new Date()
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
    });

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

/**
 * The same people, in the order they were first shown.
 *
 * Ticking someone changes where they belong: they join the logged group and the
 * list re-sorts under the finger that just tapped. Worse, the answer only comes
 * back after the save, so the page sits still and then rearranges a second
 * later. The order is fixed for as long as the page is open, and anyone who
 * turns up later joins the end.
 */
export function keepCheckInOrder<T extends CheckInPerson>(
  candidates: T[],
  order: string[]
): T[] {
  const placeOf = new Map(order.map((id, index) => [id, index]));
  return candidates
    .map((person, index) => ({ person, index }))
    .sort((left, right) => {
      const gap =
        (placeOf.get(left.person.id) ?? order.length + left.index) -
        (placeOf.get(right.person.id) ?? order.length + right.index);
      return gap;
    })
    .map((entry) => entry.person);
}
