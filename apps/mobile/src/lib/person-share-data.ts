/**
 * Share links from the phone. Everything goes through the signed-in Supabase
 * client, so the owner-only policies from migration 0015 are what guard the
 * table — the phone never holds a service key.
 *
 * A link needs the server by definition, so none of this is queued offline. A
 * lookup that fails comes back empty and the next tap makes a fresh link.
 */

import * as Crypto from "expo-crypto";
import { brand } from "@/config/brand";
import type { ContactShareSelection } from "@/lib/contact-card";
import {
  buildShareUrl,
  createShareToken,
  defaultShareExpiryChoiceId,
  mapPersonShare,
  shareExpiryFromChoice,
  shareIsLive,
  type PersonShare,
  type ShareExpiryChoiceId,
} from "@/lib/person-share";
import { supabase } from "@/lib/supabase";

const shareColumns =
  "id, person_id, token, fields, expires_at, revoked_at, last_viewed_at, view_count, created_at";

type ShareClient = Pick<typeof supabase, "from">;


export function shareUrl(share: PersonShare) {
  return buildShareUrl(brand.webUrl || "https://www.siyi.app", share.token);
}

export async function listPersonShares(
  personId: string,
  client: ShareClient = supabase,
): Promise<PersonShare[]> {
  try {
    const { data, error } = await client
      .from("person_shares")
      .select(shareColumns)
      .eq("person_id", personId)
      .is("revoked_at", null)
      .order("created_at", { ascending: false });

    if (error) return [];

    return (data ?? []).map(mapPersonShare).filter((share) => shareIsLive(share));
  } catch {
    return [];
  }
}

export type CreateShareResult =
  | { share: PersonShare; error?: null }
  /** Something went wrong that the sharer should hear about. */
  | { share: null; error: string };

export async function createPersonShare(
  {
    userId,
    personId,
    selection,
    // There is no expiry control any more; a link keeps the default life.
    expiry = defaultShareExpiryChoiceId,
  }: {
    userId: string;
    personId: string;
    selection: ContactShareSelection;
    expiry?: ShareExpiryChoiceId;
  },
  client: ShareClient = supabase,
  randomBytes: (size: number) => Uint8Array = Crypto.getRandomBytes,
): Promise<CreateShareResult> {
  try {
    const { data, error } = await client
      .from("person_shares")
      .insert({
        user_id: userId,
        person_id: personId,
        token: createShareToken(randomBytes),
        // The short bio is written on this device and never stored, so a link
        // cannot reproduce it however the picker was left.
        fields: { ...selection, bio: false },
        expires_at: shareExpiryFromChoice(expiry),
      })
      .select(shareColumns)
      .single();

    if (error) {
      return {
        share: null,
        error: "That link couldn't be created. Try again in a moment.",
      };
    }
    if (!data) {
      return { share: null, error: "That link couldn't be created." };
    }

    return { share: mapPersonShare(data) };
  } catch {
    return {
      share: null,
      error: "That link couldn't be created. Check your connection.",
    };
  }
}

export async function revokePersonShare(
  shareId: string,
  client: ShareClient = supabase,
) {
  try {
    const { error } = await client
      .from("person_shares")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", shareId);
    return !error;
  } catch {
    return false;
  }
}
