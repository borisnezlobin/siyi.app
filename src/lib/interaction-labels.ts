import { interactionTypes, type InteractionType } from "@/lib/types";

/**
 * Kept apart from the picker's icons so server code can name an interaction
 * without pulling a React icon library into the bundle.
 */
export const interactionLabels: Record<InteractionType, string> = {
  texted: "Texted",
  called: "Called",
  coffee: "Coffee",
  meal: "Meal",
  class: "Class",
  party: "Party",
  event: "Event",
  met: "Met",
  other: "Other",
};

/**
 * Updates store the label they were saved with rather than the type, so editing
 * one has to work back to a type. Anything unrecognised — including the older
 * default of "Talked" — starts from "other" rather than guessing.
 */
export function interactionTypeFromLabel(
  label: string | null | undefined,
): InteractionType {
  const normalized = (label ?? "").trim().toLowerCase();
  return (
    interactionTypes.find(
      (type) => interactionLabels[type].toLowerCase() === normalized,
    ) ?? "other"
  );
}
