import { normalizeOwnCard, ownCardIsEmpty, type OwnCard } from "@/lib/own-card";
/**
 * Resolving a share link. The public page has no session, so the lookup runs
 * through the service role — but only after the token has been checked against
 * its exact shape, and the result is redacted down to the sharer's selection
 * before it leaves this module. The `person_shares` table itself stays closed
 * to anonymous reads.
 */

import {
  isValidShareToken,
  mapPersonShare,
  normalizeShareSelection,
  redactedSharePerson,
  shareIsLive,
} from "@/lib/person-share";
import { draftsFromContactMethods } from "@/lib/contact-methods";
import type { ContactShareSelection } from "@/lib/contact-card";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Person } from "@/lib/types";

type QueryResult = { data: unknown; error: { code?: string } | null };

type Filterable = {
  eq: (column: string, value: string) => Filterable;
  order: (column: string, options: { ascending: boolean }) => Filterable;
  maybeSingle: () => PromiseLike<QueryResult>;
} & PromiseLike<QueryResult>;

export type ShareLookupClient = {
  from: (table: string) => {
    select: (columns: string) => Filterable;
    update: (values: Record<string, unknown>) => {
      eq: (column: string, value: string) => PromiseLike<{ error: unknown }>;
    };
  };
};

export type SharedPersonView = {
  shareId: string;
  viewCount: number;
  person: Person;
  selection: ContactShareSelection;
  expiresAt: string | null;
  /** The sharer's own details, when they have chosen to offer them. */
  ownerCard: OwnCard | null;
};

function adminClient(): ShareLookupClient | null {
  try {
    return createAdminClient() as unknown as ShareLookupClient;
  } catch {
    return null;
  }
}

type PersonRow = Record<string, unknown> & { id: string; full_name: string };

function personFromRow(row: PersonRow): Person {
  const text = (column: string) => {
    const value = row[column];
    return typeof value === "string" && value.trim() ? value : null;
  };

  return {
    id: row.id,
    slug: null,
    userId: "",
    fullName: row.full_name,
    preferredName: text("preferred_name"),
    profilePhotoUrl: null,
    instagramUsername: text("instagram_username"),
    phoneNumber: text("phone_number"),
    email: text("email"),
    contactMethods: [],
    birthday: text("birthday"),
    hometown: text("hometown"),
    dormOrResidence: null,
    university: text("university"),
    major: text("major"),
    graduationYear: null,
    relationshipStrength: 1,
    relationshipLabel: null,
    remindersEnabled: false,
    reminderIntervalDays: null,
    status: "active",
    firstMetAt: "",
    firstMetLocation: null,
    generalNotes: text("general_notes"),
    createdAt: "",
    updatedAt: "",
    lastInteractionAt: null,
    tags: [],
  };
}

async function contactDraftsFor(
  client: ShareLookupClient,
  personId: string,
  selection: ContactShareSelection,
) {
  if (!selection.phoneNumber && !selection.email && !selection.instagram) {
    return [];
  }

  const { data, error } = await client
    .from("person_contact_methods")
    .select("*")
    .eq("person_id", personId)
    .order("position", { ascending: true });

  // Migration 0013 may not have run; the legacy columns still carry the primary.
  if (error || !Array.isArray(data)) return [];

  return draftsFromContactMethods(
    (data as Record<string, unknown>[]).map((row) => ({
      id: String(row.id),
      personId,
      userId: "",
      kind: row.kind as "phone" | "email" | "instagram",
      value: String(row.value ?? ""),
      label: null,
      position: Number(row.position ?? 0),
      isPrimary: row.is_primary === true,
      createdAt: "",
      updatedAt: "",
    })),
  );
}

/**
 * Null for every failure the viewer could observe: bad shape, unknown token,
 * expired, revoked, archived, deleted, or the table not existing yet. The page
 * shows one message for all of them, so a token can never be confirmed to have
 * once been real.
 */
export async function resolveSharedPerson(
  token: unknown,
  providedClient?: ShareLookupClient,
): Promise<SharedPersonView | null> {
  if (!isValidShareToken(token)) return null;

  const client = providedClient ?? adminClient();
  if (!client) return null;

  const shareResult = await client
    .from("person_shares")
    .select(
      "id, person_id, token, fields, expires_at, revoked_at, last_viewed_at, view_count, created_at",
    )
    .eq("token", token)
    .maybeSingle();

  if (shareResult.error) {
    return null;
  }
  if (!shareResult.data) return null;

  const share = mapPersonShare(
    shareResult.data as Parameters<typeof mapPersonShare>[0],
  );
  if (share.token !== token) return null;
  if (!shareIsLive(share)) return null;

  const personResult = await client
    .from("people")
    .select("*")
    .eq("id", share.personId)
    .maybeSingle();

  if (personResult.error || !personResult.data) return null;

  const row = personResult.data as PersonRow;
  // Archiving someone is how you take them out of circulation; their links go
  // with them. Deletion is handled by the cascade on person_id.
  if (row.status === "archived") return null;
  if (!row.full_name) return null;

  // The bio is written on the sharer's device and never stored, so a link can
  // never carry one, whatever the stored selection says.
  const selection: ContactShareSelection = {
    ...normalizeShareSelection(share.selection),
    bio: false,
  };

  const person = personFromRow(row);
  person.contactMethods = await contactDraftsFor(
    client,
    share.personId,
    selection,
  );

  return {
    shareId: share.id,
    viewCount: share.viewCount,
    person: redactedSharePerson(person, selection),
    selection,
    expiresAt: share.expiresAt,
    ownerCard: await ownerCardFor(client, row.user_id),
  };
}

/**
 * The sharer's own card, and only if they turned the offer on. A link is about
 * the person in it; the sharer's details ride along solely because they asked.
 */
async function ownerCardFor(client: ShareLookupClient, userId: unknown) {
  if (typeof userId !== "string" || !userId) return null;

  const result = await client
    .from("user_settings")
    .select("own_card,own_card_enabled")
    .eq("user_id", userId)
    .maybeSingle();

  if (result.error || !result.data) return null;
  const row = result.data as { own_card?: unknown; own_card_enabled?: boolean };
  if (!row.own_card_enabled) return null;

  const card = normalizeOwnCard(row.own_card);
  return ownCardIsEmpty(card) ? null : card;
}

/** Best effort; a viewer should never see an error because the counter failed. */
export async function recordShareView(
  shareId: string,
  viewsSoFar: number,
  providedClient?: ShareLookupClient,
) {
  const client = providedClient ?? adminClient();
  if (!client) return;

  try {
    await client
      .from("person_shares")
      .update({
        last_viewed_at: new Date().toISOString(),
        view_count: viewsSoFar + 1,
      })
      .eq("id", shareId);
  } catch {
    // Nothing to do; the page has already rendered.
  }
}
