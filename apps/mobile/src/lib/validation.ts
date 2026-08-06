import { z } from "zod";
import { normalizeInstagramUsername } from "@/lib/instagram";
import {
  interactionTypes,
  relationshipStrengths,
} from "@/lib/types";

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
  reminderIntervalDays: z
    .number()
    .int()
    .min(1)
    .max(3650)
    .optional()
    .nullable(),
  firstMetAt: pastTimestamp.optional(),
  firstMetLocation: optionalText,
  generalNotes: optionalText,
});

export const followUpInputSchema = z.object({
  personId: z.string().uuid(),
  text: z.string().trim().min(1, "Add what you want to remember.").max(500),
  dueAt: z.string().datetime(),
});

export const interactionInputSchema = z.object({
  personId: z.string().uuid(),
  type: z.enum(interactionTypes),
  occurredAt: pastTimestamp,
  note: optionalText,
});

export const personUpdateInputSchema = z.object({
  personIds: z.array(z.string().uuid()).min(1).max(50),
  text: z.string().trim().min(1, "Add what you learned.").max(2000),
  recordedAt: pastTimestamp,
  isInteraction: z.boolean(),
  interactionLabel: z.string().trim().min(1).max(60).nullable(),
});

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
    followUps: z.array(z.unknown()).max(100_000),
    tags: z.array(z.unknown()).max(2_000),
    personTags: z.array(z.unknown()).max(100_000).optional().default([]),
  })
  .passthrough();

export type PersonInput = z.infer<typeof personInputSchema>;
export type FollowUpInput = z.infer<typeof followUpInputSchema>;
export type InteractionInput = z.infer<typeof interactionInputSchema>;
export type PersonUpdateInput = z.infer<typeof personUpdateInputSchema>;
export type ImportPreview = z.infer<typeof importPreviewSchema>;
