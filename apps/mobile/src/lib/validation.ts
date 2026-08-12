import { z } from "zod";
import { isCustomTypeIconKey } from "@/lib/custom-type-icons";
import { normalizeInstagramUsername } from "@/lib/instagram";
import {
  interactionTypes,
  personStatuses,
  relationshipStrengths,
} from "@/lib/types";

/** Matches the column check added in migration 0014. */
export const maxUniversityLength = 120;

const optionalText = z
  .string()
  .trim()
  .max(1000)
  .optional()
  .nullable()
  .transform((value) => value || null);

// A little slack absorbs a device clock that runs slightly fast.
const clockSkewToleranceMs = 5 * 60 * 1000;

// Postgres returns timestamptz with a numeric offset (+00:00), which
// z.datetime() rejects unless offsets are allowed. Without this, saving a
// person with an untouched date fails validation.
const pastTimestamp = z
  .string()
  .datetime({ offset: true })
  .refine(
    (value) => Date.parse(value) <= Date.now() + clockSkewToleranceMs,
    "Pick a date that has already happened.",
  );

export const personInputSchema = z.object({
  fullName: z.string().trim().min(1, "Add their name.").max(120),
  preferredName: z
    .string()
    .trim()
    .max(80)
    .optional()
    .nullable()
    .transform((value) => value || null),
  instagramUsername: z
    .string()
    .trim()
    .max(200)
    .optional()
    .nullable()
    .transform((value) =>
      value ? normalizeInstagramUsername(value) : null,
    )
    .refine(
      (value) => value === null || /^[a-z0-9._]{1,30}$/.test(value),
      "Check that Instagram username.",
    ),
  phoneNumber: z
    .string()
    .trim()
    .max(40)
    .optional()
    .nullable()
    .transform((value) => value || null),
  email: z
    .string()
    .trim()
    .email("Check that email address.")
    .or(z.literal(""))
    .optional()
    .nullable()
    .transform((value) => value || null),
  birthday: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .or(z.literal(""))
    .optional()
    .nullable()
    .transform((value) => value || null),
  hometown: optionalText,
  dormOrResidence: optionalText,
  university: z
    .string()
    .trim()
    .max(
      maxUniversityLength,
      `Keep the university under ${maxUniversityLength} characters.`,
    )
    .optional()
    .nullable()
    .transform((value) => value || null),
  major: optionalText,
  graduationYear: z
    .number()
    .int()
    .min(1900)
    .max(2200)
    .optional()
    .nullable(),
  relationshipStrength: z
    .number()
    .refine(
      (value): value is (typeof relationshipStrengths)[number] =>
        relationshipStrengths.includes(
          value as (typeof relationshipStrengths)[number],
        ),
    ),
  relationshipLabel: z
    .string()
    .trim()
    .max(40, "Keep the relationship name under 40 characters.")
    .optional()
    .nullable()
    .transform((value) => value || null),
  remindersEnabled: z
    .boolean()
    .optional()
    .nullable()
    .transform((value) => value ?? true),
  reminderIntervalDays: z
    .number()
    .int()
    .min(1)
    .max(3650)
    .optional()
    .nullable(),
  status: z.enum(personStatuses).optional(),
  firstMetAt: pastTimestamp.optional(),
  firstMetLocation: optionalText,
  generalNotes: optionalText,
});

export const reminderInputSchema = z.object({
  personIds: z
    .array(z.string().uuid())
    .min(1, "Choose who this is about.")
    .max(50, "That is more people than one reminder can hold.")
    .transform((ids) => Array.from(new Set(ids))),
  text: z.string().trim().min(1, "Add what you want to remember.").max(500),
  dueAt: z.string().datetime(),
});

/** Editing one cannot move it to a different person, only reword or reschedule. */
export const reminderEditSchema = reminderInputSchema.omit({ personIds: true });

const customLabel = z
  .string()
  .trim()
  .max(40, "Keep the name under 40 characters.")
  .nullish()
  .transform((value) => value || null);

// An icon is one of the app's fixed choices, so anything else is dropped
// rather than stored and rendered as nothing.
const customIcon = z
  .string()
  .trim()
  .nullish()
  .transform((value) => (isCustomTypeIconKey(value) ? value : null));

// A label belongs to "Other". Clearing it on every other type means the
// timeline never shows a stale name from a since-changed choice.
function onlyKeepLabelOnOther<
  T extends {
    type: string;
    customLabel: string | null;
    customIcon: string | null;
  },
>(value: T) {
  return value.type === "other"
    ? value
    : { ...value, customLabel: null, customIcon: null };
}

export const interactionInputSchema = z
  .object({
    personId: z.string().uuid(),
    type: z.enum(interactionTypes),
    occurredAt: pastTimestamp,
    note: optionalText,
    customLabel,
    customIcon,
  })
  .transform(onlyKeepLabelOnOther);

export const interactionEditSchema = z
  .object({
    type: z.enum(interactionTypes),
    occurredAt: pastTimestamp,
    note: optionalText,
    customLabel,
    customIcon,
  })
  .transform(onlyKeepLabelOnOther);

export const personUpdateInputSchema = z.object({
  personIds: z.array(z.string().uuid()).min(1).max(50),
  text: z.string().trim().min(1, "Add what you learned.").max(2000),
  recordedAt: pastTimestamp,
  isInteraction: z.boolean(),
  interactionLabel: z.string().trim().min(1).max(60).nullable(),
  // Older queued mutations predate this field, so the interaction kind is
  // still worked back from the label when it is missing.
  type: z.enum(interactionTypes).nullish().transform((value) => value ?? null),
  customLabel,
  customIcon,
});

export const personUpdateEditSchema = z
  .object({
    text: z.string().trim().min(1, "Add what you learned.").max(2000),
    recordedAt: pastTimestamp,
    type: z.enum(interactionTypes),
    customLabel,
    customIcon,
  })
  .transform(onlyKeepLabelOnOther);

export const importPreviewSchema = z
  .object({
    version: z.literal(1),
    exportedAt: z.string().datetime(),
    people: z
      .array(
        z.object({
          fullName: z.string().trim().min(1),
        }).passthrough(),
      )
      .max(10_000),
    interactions: z.array(z.unknown()).max(100_000),
    updates: z.array(z.unknown()).max(100_000).optional().default([]),
    updatePeople: z.array(z.unknown()).max(500_000).optional().default([]),
    reminders: z.array(z.unknown()).max(100_000),
    tags: z.array(z.unknown()).max(2_000),
    personTags: z.array(z.unknown()).max(100_000).optional().default([]),
  })
  .passthrough();

export type PersonInput = z.infer<typeof personInputSchema>;
export type ReminderInput = z.infer<typeof reminderInputSchema>;
export type InteractionInput = z.infer<typeof interactionInputSchema>;
export type PersonUpdateInput = z.infer<typeof personUpdateInputSchema>;
export type InteractionEdit = z.infer<typeof interactionEditSchema>;
export type PersonUpdateEdit = z.infer<typeof personUpdateEditSchema>;
export type ImportPreview = z.infer<typeof importPreviewSchema>;
