import { z } from "zod";
import { normalizeInstagramUsername } from "@/lib/instagram";
import { isCustomTypeIconKey } from "@/lib/custom-type-icons";
import {
  interactionTypes,
  personStatuses,
  relationshipStrengths,
} from "@/lib/types";

const optionalText = z
  .string()
  .trim()
  .max(1000)
  .nullish()
  .transform((value) => value || null);

// A little slack absorbs the difference between the browser clock and ours.
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
  fullName: z.string().trim().min(1, "Add a name").max(120),
  preferredName: z
    .string()
    .trim()
    .max(80)
    .nullish()
    .transform((value) => value || null),
  instagramUsername: z
    .string()
    .trim()
    .max(200)
    .nullish()
    .transform((value) =>
      value ? normalizeInstagramUsername(value) : null,
    )
    .pipe(z.string().regex(/^[a-z0-9._]{1,30}$/).nullable()),
  phoneNumber: z
    .string()
    .trim()
    .max(40)
    .nullish()
    .transform((value) => value || null),
  email: z
    .string()
    .trim()
    .email()
    .or(z.literal(""))
    .nullish()
    .transform((value) => value || null),
  birthday: z
    .string()
    .date()
    .or(z.literal(""))
    .nullish()
    .transform((value) => value || null),
  hometown: optionalText,
  dormOrResidence: optionalText,
  major: optionalText,
  graduationYear: z.preprocess(
    (value) => (value === "" || value === null || value === undefined ? null : value),
    z.coerce.number().int().min(1900).max(2200).nullable(),
  ),
  relationshipStrength: z.coerce.number().refine(
    (value): value is (typeof relationshipStrengths)[number] =>
      relationshipStrengths.includes(
        value as (typeof relationshipStrengths)[number],
      ),
    "Choose a relationship strength",
  ),
  relationshipLabel: z
    .string()
    .trim()
    .max(40, "Keep the relationship name under 40 characters")
    .nullish()
    .transform((value) => value || null),
  remindersEnabled: z.boolean().nullish().transform((value) => value ?? true),
  reminderIntervalDays: z.preprocess(
    (value) => (value === "" || value === null || value === undefined ? null : value),
    z.coerce.number().int().min(1).max(3650).nullable(),
  ),
  status: z.enum(personStatuses).default("active"),
  profilePhotoUrl: z
    .string()
    .trim()
    .max(1024)
    .nullish()
    .transform((value) => value || null),
  firstMetAt: pastTimestamp.optional(),
  firstMetLocation: optionalText,
  generalNotes: optionalText,
});

const customLabel = z
  .string()
  .trim()
  .max(40)
  .nullish()
  .transform((value) => value || null);

// An icon is one of the app's fixed choices, so anything else is dropped
// rather than stored and rendered as nothing.
const customIcon = z
  .string()
  .trim()
  .nullish()
  .transform((value) => (isCustomTypeIconKey(value) ? value : null));

export const interactionFields = z.object({
  personId: z.string().uuid(),
  type: z.enum(interactionTypes),
  occurredAt: pastTimestamp,
  note: z
    .string()
    .trim()
    .max(1000)
    .nullish()
    .transform((value) => value || null),
  customLabel,
  customIcon,
});

// A label belongs to "Other". Clearing it on every other type means the
// timeline never shows a stale name from a since-changed choice.
function onlyKeepLabelOnOther<T extends {
  type: string;
  customLabel: string | null;
  customIcon: string | null;
}>(value: T) {
  return value.type === "other"
    ? value
    : { ...value, customLabel: null, customIcon: null };
}

export const interactionInputSchema = interactionFields.transform(
  onlyKeepLabelOnOther,
);

export const interactionEditSchema = interactionFields
  .omit({ personId: true })
  .transform(onlyKeepLabelOnOther);

export const personUpdateEditSchema = z
  .object({
    text: z.string().trim().min(1).max(2000),
    recordedAt: pastTimestamp,
    type: z.enum(interactionTypes),
    customLabel,
    customIcon,
  })
  .transform(onlyKeepLabelOnOther);

export const followUpInputSchema = z.object({
  personId: z.string().uuid(),
  text: z.string().trim().min(1).max(500),
  dueAt: z.string().datetime(),
});

export const pushSubscriptionSchema = z.object({
  endpoint: z.string().url(),
  expirationTime: z.number().nullable().optional(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});

export const importPayloadSchema = z.object({
  version: z.literal(1),
  exportedAt: z.string().datetime(),
  people: z
    .array(personInputSchema.extend({ id: z.string().uuid().optional() }))
    .max(10_000),
  interactions: z
    .array(
      interactionFields.extend({
        id: z.string().uuid().optional(),
        // An import replays history as recorded, so it keeps the plain check.
        occurredAt: z.string().datetime(),
        sourceUpdateId: z.string().uuid().optional().nullable(),
      }),
    )
    .max(100_000),
  updates: z
    .array(
      z.object({
        id: z.string().uuid().optional(),
        text: z.string().trim().min(1).max(2000),
        recordedAt: z.string().datetime(),
        isInteraction: z.boolean(),
        interactionLabel: z.string().trim().min(1).max(60).nullable(),
      }),
    )
    .max(100_000)
    .optional()
    .default([]),
  updatePeople: z
    .array(
      z.object({
        updateId: z.string().uuid(),
        personId: z.string().uuid(),
      }),
    )
    .max(500_000)
    .optional()
    .default([]),
  followUps: z
    .array(
      followUpInputSchema.extend({
        id: z.string().uuid().optional(),
        completedAt: z.string().datetime().optional().nullable(),
      }),
    )
    .max(100_000),
  tags: z
    .array(
      z.object({
        id: z.string().uuid().optional(),
        name: z.string().trim().min(1).max(60),
      }),
    )
    .max(2_000),
  personTags: z
    .array(
      z.object({
        personId: z.string().uuid(),
        tagId: z.string().uuid(),
      }),
    )
    .max(100_000)
    .optional()
    .default([]),
});

export type PersonInput = z.infer<typeof personInputSchema>;
