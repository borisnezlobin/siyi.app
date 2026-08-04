import { z } from "zod";
import { normalizeInstagramUsername } from "@/lib/instagram";
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
  firstMetAt: z.string().datetime().optional(),
  firstMetLocation: optionalText,
  generalNotes: optionalText,
});

export const interactionInputSchema = z.object({
  personId: z.string().uuid(),
  type: z.enum(interactionTypes),
  occurredAt: z.string().datetime(),
  note: z
    .string()
    .trim()
    .max(1000)
    .nullish()
    .transform((value) => value || null),
});

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
    .array(interactionInputSchema.extend({ id: z.string().uuid().optional() }))
    .max(100_000),
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
