import { createAdminClient } from "@/lib/supabase/admin";
import type { OwnCard } from "@/lib/own-card";

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
    card: (settings.data?.own_card ?? {}) as OwnCard,
    publicFields: (data.public_fields ?? {}) as Record<string, boolean>,
  };
}
