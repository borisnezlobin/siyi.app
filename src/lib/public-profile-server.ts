import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeOwnCard, type OwnCard } from "@/lib/own-card";
import {
  fallbackKey,
  isMissingSchema,
  readFallback,
  withoutFallback,
} from "@/lib/schema-fallback";

export type PublicProfile = {
  handle: string;
  tag: string;
  displayName: string;
  card: OwnCard;
  publicFields: Record<string, boolean>;
};

/**
 * A profile page has no session, so the lookup runs through the service role —
 * but only ever returns a row the owner has marked public, and only the fields
 * they ticked. A page that is off is indistinguishable from one that never
 * existed, so a handle cannot be confirmed by probing.
 */
export async function resolvePublicProfile(
  handle: string,
  tag: string,
): Promise<PublicProfile | null> {
  let client;
  try {
    client = createAdminClient();
  } catch {
    return null;
  }

  const { data, error } = await client
    .from("user_profiles")
    .select("handle,handle_tag,display_name,profile_public,public_fields,auth_user_id")
    .ilike("handle", handle)
    .eq("handle_tag", tag)
    .maybeSingle();

  if (isMissingSchema(error)) return resolveFromFallback(client, handle, tag);
  if (error || !data || !data.profile_public) return null;

  const settings = await client
    .from("user_settings")
    .select("own_card")
    .eq("user_id", data.auth_user_id)
    .maybeSingle();

  return {
    handle: data.handle,
    tag: data.handle_tag,
    displayName: data.display_name || data.handle,
    card: normalizeOwnCard(withoutFallback(settings.data?.own_card)),
    publicFields: (data.public_fields ?? {}) as Record<string, boolean>,
  };
}


/**
 * The same lookup against the fallback blob, for before migration 0019 has run.
 * PostgREST can filter inside jsonb, so this is still one indexed-ish query
 * rather than a scan in application code.
 */
async function resolveFromFallback(
  client: ReturnType<typeof createAdminClient>,
  handle: string,
  tag: string,
): Promise<PublicProfile | null> {
  const { data, error } = await client
    .from("user_settings")
    .select("own_card,user_id")
    .eq(`own_card->${fallbackKey}->profile->>handle`, handle)
    .eq(`own_card->${fallbackKey}->profile->>tag`, tag)
    .maybeSingle();

  if (error || !data) return null;

  const stored = readFallback(data.own_card).profile;
  if (!stored?.isPublic) return null;

  const card = normalizeOwnCard(withoutFallback(data.own_card));
  return {
    handle: stored.handle,
    tag: stored.tag,
    displayName: card.preferredName || card.fullName || stored.handle,
    card,
    publicFields: stored.publicFields ?? {},
  };
}
