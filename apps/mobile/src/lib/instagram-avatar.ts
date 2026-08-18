import { File, Paths } from "expo-file-system";
import { normalizeInstagramUsername } from "@/lib/instagram";

/**
 * The picture on someone's public Instagram profile.
 *
 * Instagram has no API for this — the Basic Display one was retired at the end
 * of 2024, and the Graph API only reaches accounts that have authorised you.
 * What is left is the endpoint the website's own pages call, which answers
 * without a login. That makes this best-effort by nature: undocumented, rate
 * limited by IP, and liable to change without notice. Every failure is
 * silent, and nothing in the app depends on it working.
 *
 * It runs on the phone rather than the server on purpose. Instagram throttles
 * datacenter ranges hard, so the same request from a serverless function is
 * mostly refused; from a phone it is one ordinary request from an ordinary
 * connection, and one user's rate limit is their own.
 */

const profileEndpoint =
  "https://www.instagram.com/api/v1/users/web_profile_info/";

// The web client's own app id, sent by instagram.com on every one of these
// requests. Without it the endpoint answers 401.
const webAppId = "936619743392459";

const requestTimeoutMs = 6000;

/**
 * Instagram answers 400 unless the request looks like one its own pages make.
 * A browser attaches Referer and Sec-Fetch-Site for free; a bare fetch sends
 * neither. The app id alone is not enough.
 */
const browserHeaders = {
  "X-IG-App-ID": webAppId,
  Referer: "https://www.instagram.com/",
  "Sec-Fetch-Site": "same-origin",
} as const;

export type InstagramAvatar = {
  uri: string;
  mimeType: string;
  username: string;
};

type ProfileResponse = {
  data?: {
    user?: {
      profile_pic_url_hd?: string;
      profile_pic_url?: string;
    } | null;
  };
};

/**
 * The signed CDN link, or null. The link expires — `oe` is its expiry — so it
 * is only ever used immediately, never stored.
 */
export async function findInstagramAvatarUrl(
  handle: string,
): Promise<string | null> {
  const username = normalizeInstagramUsername(handle);
  if (!username) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);

  try {
    const response = await fetch(
      `${profileEndpoint}?username=${encodeURIComponent(username)}`,
      {
        headers: browserHeaders,
        signal: controller.signal,
      },
    );
    if (!response.ok) return null;

    const body = (await response.json()) as ProfileResponse;
    const user = body.data?.user;
    // A private account still shows its picture, username and bio to anyone
    // who opens the profile — only posts and followers are behind the wall.
    // The picture was set knowing that, so it is not private information, and
    // this is only ever asked for about somebody the user already knows well
    // enough to have added.
    if (!user) return null;

    return user.profile_pic_url_hd || user.profile_pic_url || null;
  } catch {
    // Offline, throttled, timed out, or the endpoint moved. All the same here.
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Downloads the picture to a file the upload path can read, because the CDN
 * link cannot be handed on: it is signed and short-lived, so a row holding one
 * would show a broken image within the day.
 */
export async function downloadInstagramAvatar(
  handle: string,
): Promise<InstagramAvatar | null> {
  const username = normalizeInstagramUsername(handle);
  const url = await findInstagramAvatarUrl(username);
  if (!url) return null;

  try {
    const destination = new File(Paths.cache, `instagram-${username}.jpg`);
    if (destination.exists) destination.delete();
    await File.downloadFileAsync(url, destination, { idempotent: true });
    if (!destination.exists) return null;

    return {
      uri: destination.uri,
      mimeType: "image/jpeg",
      username,
    };
  } catch {
    return null;
  }
}
