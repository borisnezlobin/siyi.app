import { z } from "zod";
import { interactionFields } from "@/lib/validation";

/**
 * Two separate things, deliberately kept apart.
 *
 * Logging an interaction says "I saw or spoke to these people". It can name
 * several at once and its words are optional — the date is the point, because
 * that is what reminders are measured from.
 *
 * An update is a fact you learned about someone. It has words by definition and
 * never claims you spoke to them, so it writes nothing reminders can read.
 */

const maxPeoplePerCapture = 50;

const personIds = z
  .array(z.string().uuid())
  .min(1, "Choose who you saw.")
  .max(maxPeoplePerCapture, "That is more people than one entry can hold.")
  .transform((ids) => Array.from(new Set(ids)));

export const interactionLogSchema = interactionFields
  .omit({ personId: true })
  .extend({ personIds })
  // A name belongs to "Other". Clearing it elsewhere means the timeline never
  // shows a stale label from a since-changed choice.
  .transform((value) =>
    value.type === "other"
      ? value
      : { ...value, customLabel: null, customIcon: null },
  );

export const personUpdateInputSchema = z.object({
  personIds,
  text: z
    .string()
    .trim()
    .min(1, "Write what you learned.")
    .max(2000, "That update is too long to save."),
  recordedAt: interactionFields.shape.occurredAt,
});

export type InteractionLogInput = z.infer<typeof interactionLogSchema>;
export type PersonUpdateInput = z.infer<typeof personUpdateInputSchema>;

/**
 * The endpoint accepted a single personId long before it accepted a list, and
 * older clients still send that shape.
 */
export function withPersonIdList(body: unknown) {
  if (!body || typeof body !== "object") return body;
  const payload = body as Record<string, unknown>;
  if (Array.isArray(payload.personIds)) return payload;
  return payload.personId
    ? { ...payload, personIds: [payload.personId] }
    : payload;
}
