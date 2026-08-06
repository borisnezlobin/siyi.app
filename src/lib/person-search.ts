export type PickablePerson = {
  id: string;
  fullName: string;
  preferredName?: string | null;
  profilePhotoUrl?: string | null;
  lastInteractionAt?: string | null;
};

export function normalizeForSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

const startsWholeString = 0;
const startsAWord = 1;
const appearsAnywhere = 2;
const noMatch = 3;

function matchRank(name: string, query: string) {
  const haystack = normalizeForSearch(name);
  if (!haystack) return noMatch;
  if (haystack.startsWith(query)) return startsWholeString;
  if (haystack.split(/[\s-]+/).some((word) => word.startsWith(query))) {
    return startsAWord;
  }
  return haystack.includes(query) ? appearsAnywhere : noMatch;
}

// Someone never logged sorts last, and two of them compare equal. Using
// -Infinity here instead would make that subtraction NaN and scramble the sort.
function recencyOf(person: PickablePerson) {
  const parsed = person.lastInteractionAt
    ? new Date(person.lastInteractionAt).getTime()
    : Number.NaN;
  return Number.isNaN(parsed) ? 0 : parsed;
}

function displayNameOf(person: PickablePerson) {
  return person.preferredName ?? person.fullName;
}

/**
 * A plain dropdown stops being usable somewhere past a hundred contacts, so the
 * list is always both filtered and ranked. Typing "sam" should offer Sam before
 * Rosamund, and an empty box should offer whoever the user saw most recently —
 * that is nearly always who they are about to log.
 */
export function rankPeopleForPicker(
  people: PickablePerson[],
  query: string,
  limit = 8,
): PickablePerson[] {
  const normalizedQuery = normalizeForSearch(query);

  const scored = people
    .map((person) => {
      if (!normalizedQuery) return { person, rank: startsWholeString };
      const rank = Math.min(
        matchRank(person.fullName, normalizedQuery),
        person.preferredName
          ? matchRank(person.preferredName, normalizedQuery)
          : noMatch,
      );
      return { person, rank };
    })
    .filter((entry) => entry.rank !== noMatch);

  scored.sort((left, right) => {
    if (left.rank !== right.rank) return left.rank - right.rank;
    const recencyGap = recencyOf(right.person) - recencyOf(left.person);
    if (recencyGap !== 0) return recencyGap;
    return displayNameOf(left.person).localeCompare(displayNameOf(right.person));
  });

  return scored.slice(0, limit).map((entry) => entry.person);
}
