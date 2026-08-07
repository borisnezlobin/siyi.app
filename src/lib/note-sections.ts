import type { PersonNote } from "@/lib/types";

export const maxNoteHeadingLength = 60;
export const maxNoteBodyLength = 4000;
export const maxNoteSectionsPerPerson = 30;

export const missingNoteSectionsMessage =
  "Note sections are not switched on yet. Your other changes still save.";

/** Headings are typed by hand on every person, so "  Interests " and
 * "Interests" have to count as the same one. */
export function normalizeNoteHeading(heading: string) {
  return heading.trim().replace(/\s+/g, " ");
}

type SortableNote = Pick<PersonNote, "id" | "position" | "createdAt">;

export function orderedNoteSections<T extends SortableNote>(sections: T[]): T[] {
  return [...sections].sort((a, b) => {
    if (a.position !== b.position) return a.position - b.position;
    const createdDifference =
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    if (createdDifference !== 0) return createdDifference;
    return a.id.localeCompare(b.id);
  });
}

export function nextNotePosition(sections: Pick<PersonNote, "position">[]) {
  return sections.reduce((highest, { position }) => {
    return position >= highest ? position + 1 : highest;
  }, 0);
}

/**
 * Moves one section a single step and hands back the whole list renumbered
 * from zero, so the saved positions never drift apart from what is on screen.
 */
export function moveNoteSection<T extends SortableNote>(
  sections: T[],
  sectionId: string,
  direction: "up" | "down",
): T[] {
  const ordered = orderedNoteSections(sections);
  const index = ordered.findIndex((section) => section.id === sectionId);
  const target = direction === "up" ? index - 1 : index + 1;

  if (index === -1 || target < 0 || target >= ordered.length) {
    return renumbered(ordered);
  }

  const swapped = [...ordered];
  [swapped[index], swapped[target]] = [swapped[target], swapped[index]];
  return renumbered(swapped);
}

function renumbered<T extends SortableNote>(sections: T[]): T[] {
  return sections.map((section, index) =>
    section.position === index ? section : { ...section, position: index },
  );
}

/**
 * Reuse without a setup step: the headings this person does not have yet,
 * drawn from what the user already wrote on everyone else.
 */
export function suggestedNoteHeadings({
  previouslyUsed,
  alreadyOnThisPerson,
  limit = 6,
}: {
  previouslyUsed: string[];
  alreadyOnThisPerson: string[];
  limit?: number;
}) {
  const taken = new Set(
    alreadyOnThisPerson.map((heading) =>
      normalizeNoteHeading(heading).toLowerCase(),
    ),
  );
  const suggestions: string[] = [];

  for (const candidate of previouslyUsed) {
    const heading = normalizeNoteHeading(candidate);
    if (!heading) continue;
    const key = heading.toLowerCase();
    if (taken.has(key)) continue;
    taken.add(key);
    suggestions.push(heading);
    if (suggestions.length === limit) break;
  }

  return suggestions;
}
