/**
 * Somewhere to keep profiles and classes before migration 0019 has run.
 *
 * The app already does this for contact methods: read the new table, fall back
 * to the old columns when it is not there. This is the same idea, except the
 * fallback is a reserved key inside `user_settings.own_card`, which exists
 * everywhere as of migration 0018.
 *
 * It is a stopgap, not a design. The table is better in every way — real
 * uniqueness on a handle, row-level security on a class, no whole-blob writes —
 * so everything here checks the real schema first and only reaches for the blob
 * when Postgres says the column or table is missing. Once 0019 is applied the
 * fallback stops being read, and `migrateFallback` moves anything already in it
 * across.
 */

import type { PersonClass } from "@/lib/classes";

/** Reserved so it can never collide with a field of somebody's own card. */
export const fallbackKey = "__siyi_fallback";

export type FallbackProfile = {
  handle: string;
  tag: string;
  isPublic: boolean;
  publicFields: Record<string, boolean>;
};

export type FallbackBlob = {
  profile?: FallbackProfile;
  /** Classes keyed by person id. */
  classes?: Record<string, PersonClass[]>;
};

/** Postgres codes for "that column is not there" and "that table is not there". */
const missingSchemaCodes = new Set([
  "42P01",
  "42703",
  "PGRST204",
  "PGRST205",
  "PGRST202",
]);

export function isMissingSchema(error: { code?: string } | null | undefined) {
  return Boolean(error?.code && missingSchemaCodes.has(error.code));
}

export function readFallback(ownCard: unknown): FallbackBlob {
  if (!ownCard || typeof ownCard !== "object") return {};
  const blob = (ownCard as Record<string, unknown>)[fallbackKey];
  return blob && typeof blob === "object" ? (blob as FallbackBlob) : {};
}

/**
 * Merges a change into the card without disturbing the fields around it — the
 * card and the fallback share one column, so a careless write would wipe one of
 * them.
 */
export function writeFallback(
  ownCard: unknown,
  change: FallbackBlob,
): Record<string, unknown> {
  const card =
    ownCard && typeof ownCard === "object"
      ? { ...(ownCard as Record<string, unknown>) }
      : {};
  const current = readFallback(ownCard);
  card[fallbackKey] = { ...current, ...change };
  return card;
}

/** Strips the reserved key, so a card never shows it as one of its own fields. */
export function withoutFallback(ownCard: unknown): Record<string, unknown> {
  if (!ownCard || typeof ownCard !== "object") return {};
  const card = { ...(ownCard as Record<string, unknown>) };
  delete card[fallbackKey];
  return card;
}
