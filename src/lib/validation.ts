import { z } from "zod";
import {
  contactMethodKinds,
  maxContactMethodLabelLength,
  maxContactMethodValueLength,
  maxContactMethodsPerKind,
} from "@/lib/contact-methods";
import { normalizeInstagramUsername } from "@/lib/instagram";
import {
  defaultShareExpiryChoiceId,
  normalizeShareSelection,
  shareExpiryChoices,
} from "@/lib/person-share";
import { isCustomTypeIconKey } from "@/lib/custom-type-icons";
import {
  maxNoteBodyLength,
  maxNoteHeadingLength,
  maxNoteSectionsPerPerson,
  normalizeNoteHeading,
} from "@/lib/note-sections";
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

export const contactMethodInputSchema = z
  .array(
    z.object({
      id: z.string().uuid().optional(),
      kind: z.enum(contactMethodKinds),
      value: z.string().trim().max(maxContactMethodValueLength),
      label: z
        .string()
        .trim()
        .max(maxContactMethodLabelLength)
        .nullish()
        .transform((value) => value || null),
      isPrimary: z
        .boolean()
        .nullish()
        .transform((value) => value === true),
    }),
  )
  .max(maxContactMethodsPerKind * contactMethodKinds.length);

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
  university: z
    .string()
    .trim()
    .max(
      maxUniversityLength,
      `Keep the university under ${maxUniversityLength} characters`,
    )
    .nullish()
    .transform((value) => value || null),
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
  // Optional everywhere: an older client, and the phone app, still send only
  // the three single fields above.
  contactMethods: contactMethodInputSchema.optional(),
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

const noteHeading = z
  .string()
  .trim()
  .min(1, "Give the section a heading")
  .max(
    maxNoteHeadingLength,
    `Keep the heading under ${maxNoteHeadingLength} characters`,
  )
  .transform(normalizeNoteHeading);

const noteBody = z
  .string()
  .max(maxNoteBodyLength, "That section is too long to save")
  .nullish()
  .transform((value) => value ?? "");

export const personNoteInputSchema = z.object({
  personId: z.string().uuid(),
  heading: noteHeading,
  body: noteBody,
});

export const personNoteEditSchema = z.object({
  heading: noteHeading,
  body: noteBody,
});

export const personNoteOrderSchema = z.object({
  personId: z.string().uuid(),
  noteIds: z.array(z.string().uuid()).min(1).max(maxNoteSectionsPerPerson),
});

export const reminderInputSchema = z.object({
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
  reminders: z
    .array(
      reminderInputSchema.extend({
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
  // Absent from every export written before migration 0013, so an older file
  // still imports cleanly.
  contactMethods: z
    .array(
      z.object({
        id: z.string().uuid().optional(),
        personId: z.string().uuid(),
        kind: z.enum(contactMethodKinds),
        value: z.string().trim().min(1).max(maxContactMethodValueLength),
        label: z
          .string()
          .trim()
          .max(maxContactMethodLabelLength)
          .nullish()
          .transform((value) => value || null),
        position: z.coerce.number().int().min(0).max(1000).optional().default(0),
        isPrimary: z.boolean().optional().default(false),
      }),
    )
    .max(100_000)
    .optional()
    .default([]),
});

export type PersonInput = z.infer<typeof personInputSchema>;

/**
 * Creating a share link. The selection is read field by field and defaults to
 * false, so an unrecognised or missing key can only ever expose less.
 */
export const personShareInputSchema = z.object({
  personId: z.string().uuid(),
  expiry: z
    .enum(shareExpiryChoices.map((choice) => choice.id) as [string, ...string[]])
    .optional()
    .default(defaultShareExpiryChoiceId),
  selection: z
    .record(z.string(), z.boolean())
    .optional()
    .default({})
    .transform(normalizeShareSelection),
});

export type PersonShareInput = z.infer<typeof personShareInputSchema>;
