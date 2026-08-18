import * as Crypto from "expo-crypto";
import { createHandleTag, normalizeHandle } from "@/lib/handles";
import { isMissingColumn } from "@/lib/pending-columns";
import { supabase } from "@/lib/supabase";

export type OwnProfile = {
  handle: string;
  tag: string;
  isPublic: boolean;
  publicFields: Record<string, boolean>;
};

const empty: OwnProfile = { handle: "", tag: "", isPublic: false, publicFields: {} };

export async function getOwnProfile(userId: string): Promise<OwnProfile> {
  const { data, error } = await supabase
    .from("user_profiles")
    .select("handle,handle_tag,profile_public,public_fields")
    .eq("auth_user_id", userId)
    .maybeSingle();

  // Missing until migration 0019 has run, which is not worth an error screen.
  // Any OTHER error has to be thrown rather than read as a blank profile: the
  // saver below mints a new tag when it sees an empty one, so answering a
  // dropped connection with `empty` re-minted the tag and broke every link the
  // user had already handed out. An absent row is a real blank; an unanswered
  // question is not.
  if (error && !isMissingColumn(error)) throw error;
  if (error || !data) return empty;

  return {
    handle: data.handle ?? "",
    tag: data.handle_tag ?? "",
    isPublic: data.profile_public ?? false,
    publicFields: (data.public_fields ?? {}) as Record<string, boolean>,
  };
}

/**
 * The tag is minted once and then kept, so renaming yourself does not break the
 * links people already have.
 */
export async function saveOwnProfile(
  userId: string,
  changes: {
    handle?: string;
    isPublic?: boolean;
    publicFields?: Record<string, boolean>;
  },
) {
  const update: Record<string, unknown> = {};

  if (changes.handle !== undefined) {
    const handle = normalizeHandle(changes.handle);
    const current = await getOwnProfile(userId);
    update.handle = handle;
    update.handle_tag =
      current.tag || createHandleTag((size) => Crypto.getRandomBytes(size));
  }
  if (changes.isPublic !== undefined) update.profile_public = changes.isPublic;
  if (changes.publicFields !== undefined) {
    update.public_fields = Object.fromEntries(
      Object.entries(changes.publicFields).filter(([, on]) => on === true),
    );
  }

  const { error } = await supabase
    .from("user_profiles")
    .update(update)
    .eq("auth_user_id", userId);

  if (error) {
    if (error.code === "23505") {
      throw new Error("Somebody already has that handle. Try another.");
    }
    throw error;
  }
}
