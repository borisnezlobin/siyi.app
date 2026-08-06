import { interactionLabels } from "@/lib/interaction-labels";
import { interactionTypes, type InteractionType } from "@/lib/types";

/**
 * Logging who you saw is the fast path, so the composer asks for a plain title
 * rather than making people pick from a grid of icons. "Coffee" and "Called"
 * still land on the types the timeline already knows how to draw; anything
 * else the user invents is stored as their own words.
 */

export const defaultInteractionType: InteractionType = "met";

/** Offered as one-tap shortcuts under the title field. */
export const interactionTitleSuggestions = [
  "Coffee",
  "Meal",
  "Called",
  "Texted",
  "Class",
  "Party",
  "Event",
];

export type TitledInteraction = {
  type: InteractionType;
  customLabel: string | null;
};

export function interactionFromTitle(
  title: string | null | undefined,
): TitledInteraction {
  const trimmed = (title ?? "").trim();
  if (!trimmed) return { type: defaultInteractionType, customLabel: null };

  const normalized = trimmed.toLowerCase();
  const known = interactionTypes.find(
    (type) => type !== "other" && interactionLabels[type].toLowerCase() === normalized,
  );

  return known
    ? { type: known, customLabel: null }
    : { type: "other", customLabel: trimmed };
}
