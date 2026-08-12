"use client";

import { createClient } from "@/lib/supabase/client";

/**
 * Looking for a picture for someone who has none, from the browser.
 *
 * The lookup itself goes through `/api/people/instagram-photo`, because the
 * browser cannot call Instagram directly. Anything other than an image comes
 * back as nothing at all, and nothing is what the caller shows.
 */
export async function findInstagramPhoto(
  instagramHandle: string,
): Promise<Blob | null> {
  if (!instagramHandle.trim()) return null;

  try {
    const response = await fetch(
      `/api/people/instagram-photo?username=${encodeURIComponent(instagramHandle)}`,
    );
    if (!response.ok || response.status === 204) return null;

    const blob = await response.blob();
    return blob.size > 0 ? blob : null;
  } catch {
    return null;
  }
}

/**
 * Puts an offered picture into storage and returns the path the person row
 * keeps, in the same shape and bucket a hand-picked upload uses.
 */
export async function saveFoundPhoto(
  personId: string,
  photo: Blob,
): Promise<string | null> {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const filePath = `${user.id}/${crypto.randomUUID()}.jpg`;
    const { error } = await supabase.storage
      .from("avatars")
      .upload(filePath, photo, {
        cacheControl: "3600",
        contentType: photo.type || "image/jpeg",
        upsert: false,
      });
    if (error) return null;

    const response = await fetch(`/api/people/${personId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profilePhotoUrl: filePath }),
    });
    return response.ok ? filePath : null;
  } catch {
    return null;
  }
}
