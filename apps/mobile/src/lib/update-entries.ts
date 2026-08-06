import { interactionTypeFromLabel } from "@/lib/interaction-labels";
import type { Interaction, InteractionType, PersonUpdate } from "@/lib/types";

/**
 * Both halves of the timeline can be edited, so the composer is handed one
 * shape rather than two.
 */
export type EditableEntry = {
  kind: "update" | "interaction";
  id: string;
  type: InteractionType;
  body: string;
  at: string;
  customLabel: string | null;
  customIcon: string | null;
};

/**
 * An update stores the label it was saved with rather than the type, so editing
 * one works back to a type. The linked interaction is where the user's own
 * words and chosen icon actually live.
 */
export function editableEntryFromUpdate(
  update: PersonUpdate,
  linkedInteraction?: Interaction | null,
): EditableEntry {
  const type = update.isInteraction
    ? linkedInteraction?.type ??
      interactionTypeFromLabel(update.interactionLabel)
    : "other";
  const label = update.interactionLabel?.trim() || "";
  const customLabel =
    linkedInteraction?.customLabel ??
    (type === "other" && label && interactionTypeFromLabel(label) === "other"
      ? label
      : null);

  return {
    kind: "update",
    id: update.id,
    type,
    body: update.text,
    at: update.recordedAt,
    customLabel,
    customIcon: linkedInteraction?.customIcon ?? null,
  };
}

/**
 * An interaction the database created from an update has no editable identity
 * of its own — it is kept in step with that update instead.
 */
export function editableEntryFromInteraction(
  interaction: Interaction,
): EditableEntry | null {
  if (interaction.sourceUpdateId) return null;
  return {
    kind: "interaction",
    id: interaction.id,
    type: interaction.type,
    body: interaction.note ?? "",
    at: interaction.occurredAt,
    customLabel: interaction.customLabel,
    customIcon: interaction.customIcon,
  };
}
