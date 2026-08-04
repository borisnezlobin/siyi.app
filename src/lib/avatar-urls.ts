import type { SupabaseClient } from "@supabase/supabase-js";

const publicAvatarPathPattern =
  /^https?:\/\/[^/]+\/storage\/v1\/object\/public\/avatars\/(.+)$/;

export function avatarStoragePath(value: string | null | undefined) {
  if (!value) return null;
  const publicPath = value.match(publicAvatarPathPattern)?.[1];
  if (publicPath) return decodeURIComponent(publicPath);
  return value.startsWith("http://") || value.startsWith("https://")
    ? null
    : value;
}

export function isOwnedAvatarReference(
  value: string | null | undefined,
  userId: string,
) {
  if (!value) return true;
  return avatarStoragePath(value)?.startsWith(`${userId}/`) ?? false;
}

export async function resolveAvatarUrls(
  supabase: SupabaseClient,
  values: (string | null | undefined)[],
) {
  const paths = Array.from(
    new Set(values.map(avatarStoragePath).filter((path) => path !== null)),
  );
  const urls = new Map<string, string>();

  if (paths.length === 0) return urls;

  const { data, error } = await supabase.storage
    .from("avatars")
    .createSignedUrls(paths, 60 * 60);

  if (error) throw new Error(error.message);

  for (const item of data) {
    if (item.path && item.signedUrl) {
      urls.set(item.path, item.signedUrl);
    }
  }

  return urls;
}

export function resolvedAvatarUrl(
  value: string | null | undefined,
  signedUrls: Map<string, string>,
) {
  if (!value) return null;
  const path = avatarStoragePath(value);
  return path ? signedUrls.get(path) ?? null : value;
}
