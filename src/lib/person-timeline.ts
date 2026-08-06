import { interactionTypeFromLabel } from "@/lib/interaction-labels";
import type { Interaction, InteractionType, PersonUpdate } from "@/lib/types";

/**
 * A profile shows two kinds of history in one column: interactions, which
 * answer "when did I last see them", and updates, which are facts you learned.
 * Rows written before the two were told apart carry is_interaction = true and
 * must keep reading exactly as they always have, so nothing here reinterprets
 * what was stored — it only decides how each row is titled.
 */

export type PersonTimelineEntry = {
  id: string;
  at: string;
  title: string;
  icon: string | null;
  body: string | null;
  countsAsContact: boolean;
  editable: {
    kind: "update" | "interaction";
    id: string;
    type: InteractionType;
    body: string;
    at: string;
    countsAsContact: boolean;
    customLabel?: string | null;
    customIcon?: string | null;
  };
};

const updateTitle = "Update";

/**
 * The profile has always phrased these slightly more fully than the composer
 * chips do, and existing entries have to keep reading the way they read today.
 */
const timelineTitles: Record<InteractionType, string> = {
  met: "Met",
  texted: "Texted",
  called: "Called",
  coffee: "Coffee",
  meal: "Shared a meal",
  party: "Party",
  class: "Class",
  event: "Event",
  other: "Other",
};

export function buildPersonTimeline(
  updates: PersonUpdate[],
  interactions: Interaction[],
): PersonTimelineEntry[] {
  const updateEntries = updates.map((update) => ({
    id: `update-${update.id}`,
    at: update.recordedAt,
    title: update.interactionLabel || updateTitle,
    icon: null,
    body: update.text,
    countsAsContact: update.isInteraction,
    editable: {
      kind: "update" as const,
      id: update.id,
      type: interactionTypeFromLabel(update.interactionLabel),
      body: update.text,
      at: update.recordedAt,
      countsAsContact: update.isInteraction,
    },
  }));

  // An interaction the database created from an update is already on the
  // timeline as that update, so showing it again would double the entry.
  const interactionEntries = interactions
    .filter((interaction) => !interaction.sourceUpdateId)
    .map((interaction) => ({
      id: `interaction-${interaction.id}`,
      at: interaction.occurredAt,
      title:
        interaction.customLabel ||
        timelineTitles[interaction.type] ||
        interaction.type,
      icon: interaction.customIcon,
      body: interaction.note,
      countsAsContact: true,
      editable: {
        kind: "interaction" as const,
        id: interaction.id,
        type: interaction.type,
        body: interaction.note ?? "",
        at: interaction.occurredAt,
        countsAsContact: true,
        customLabel: interaction.customLabel,
        customIcon: interaction.customIcon,
      },
    }));

  return [...updateEntries, ...interactionEntries].sort(
    (left, right) => new Date(right.at).getTime() - new Date(left.at).getTime(),
  );
}

/**
 * The date every reminder is measured from. Only interactions move it — an
 * update is something you learned, not proof you spoke.
 */
export function lastContactAt(interactions: Interaction[]): string | null {
  return (
    interactions
      .map((interaction) => interaction.occurredAt)
      .sort()
      .at(-1) ?? null
  );
}
