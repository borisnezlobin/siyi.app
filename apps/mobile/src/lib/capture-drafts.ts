import { isCustomTypeIconKey } from "@/lib/custom-type-icons";
import { timestampFromDateInput } from "@/lib/date-input";
import { interactionFromTitle } from "@/lib/interaction-title";
import type { InteractionInput, PersonUpdateInput } from "@/lib/validation";

/**
 * The two things the composer can save, kept apart on purpose.
 *
 * Logging an interaction says you saw or spoke to someone. Several people can
 * share one evening, but each of them gets their own row, because "when did I
 * last see them" is a separate answer per person and it is what reminders read.
 *
 * An update is a fact you learned. It never claims contact, so it writes no
 * interaction at all and nobody's reminder moves.
 */

export type InteractionDraft = {
  personIds: string[];
  title: string;
  occurredOn: string;
  note: string;
  icon?: string | null;
};

export function interactionRowsFor(
  draft: InteractionDraft,
  now: Date = new Date(),
): InteractionInput[] {
  const { type, customLabel } = interactionFromTitle(draft.title);
  const occurredAt = timestampFromDateInput(draft.occurredOn, now);

  return Array.from(new Set(draft.personIds)).map((personId) => ({
    personId,
    type,
    occurredAt,
    note: draft.note.trim() || null,
    customLabel,
    customIcon:
      type === "other" && isCustomTypeIconKey(draft.icon) ? draft.icon : null,
  }));
}

export function learnedUpdateFor(
  draft: { personIds: string[]; text: string; recordedOn: string },
  now: Date = new Date(),
): PersonUpdateInput {
  return {
    personIds: Array.from(new Set(draft.personIds)),
    text: draft.text.trim(),
    recordedAt: timestampFromDateInput(draft.recordedOn, now),
    // The decision: something you learned is not proof you spoke.
    isInteraction: false,
    interactionLabel: null,
    type: null,
    customLabel: null,
    customIcon: null,
  };
}
