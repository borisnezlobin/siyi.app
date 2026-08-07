import { getAuthenticatedUser } from "@/lib/auth";
import { normalizeOwnCard, type OwnCard } from "@/lib/own-card";
import { createClient } from "@/lib/supabase/server";

type OwnCardSettings = {
  card: OwnCard;
  enabled: boolean;
  defaultUniversity: string;
};

const emptySettings: OwnCardSettings = {
  card: {},
  enabled: false,
  defaultUniversity: "",
};

/**
 * Reads the owner's own details. Anything missing — no row yet, or a deployment
 * that lands before migration 0018 — comes back as the empty card rather than
 * throwing, because none of this is worth failing a page render over.
 */
export async function getOwnCardSettings(): Promise<OwnCardSettings> {
  const user = await getAuthenticatedUser();
  if (!user) return emptySettings;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("user_settings")
    .select("own_card,own_card_enabled,default_university")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !data) return emptySettings;

  return {
    card: normalizeOwnCard(data.own_card),
    enabled: data.own_card_enabled ?? false,
    defaultUniversity: data.default_university ?? "",
  };
}

export async function getDefaultUniversity() {
  return (await getOwnCardSettings()).defaultUniversity;
}
