import { NextResponse, type NextRequest } from "next/server";
import { requireAuthenticatedRequest } from "@/lib/api-auth";
import { normalizeInstagramUsername } from "@/lib/instagram";

export const dynamic = "force-dynamic";

/**
 * The picture on someone's public Instagram profile, fetched for the browser.
 *
 * The browser cannot ask for this itself — Instagram sends no CORS headers — so
 * the request is made here. That is also this route's weakness: Instagram
 * throttles datacenter ranges far harder than home connections, so a deployed
 * server is refused much of the time. The phone app asks Instagram directly for
 * exactly that reason.
 *
 * Every failure is a plain 204. Nothing is offered, nothing is said, and the
 * page carries on as though the feature did not exist — which is the only
 * honest behaviour for a lookup that cannot be relied on.
 */

const profileEndpoint =
  "https://www.instagram.com/api/v1/users/web_profile_info/";
const webAppId = "936619743392459";
const requestTimeoutMs = 6000;
const maxImageBytes = 5 * 1024 * 1024;

type ProfileResponse = {
  data?: {
    user?: {
      profile_pic_url_hd?: string;
      profile_pic_url?: string;
    } | null;
  };
};

/**
 * Instagram answers 400 unless the request looks like one its own pages make.
 * A browser attaches Referer and Sec-Fetch-Site for free; server-side fetch
 * sends neither, which is why every lookup from here failed regardless of
 * where it came from. The app id alone is not enough.
 */
const browserHeaders = {
  "X-IG-App-ID": webAppId,
  Referer: "https://www.instagram.com/",
  "Sec-Fetch-Site": "same-origin",
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
} as const;

const nothingFound = new NextResponse(null, { status: 204 });

export async function GET(request: NextRequest) {
  try {
    await requireAuthenticatedRequest(request);
  } catch {
    return new NextResponse(null, { status: 401 });
  }

  const username = normalizeInstagramUsername(
    request.nextUrl.searchParams.get("username") ?? "",
  );
  if (!username) return nothingFound;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);

  try {
    const profile = await fetch(
      `${profileEndpoint}?username=${encodeURIComponent(username)}`,
      { headers: browserHeaders, signal: controller.signal },
    );
    if (!profile.ok) return nothingFound;

    const body = (await profile.json()) as ProfileResponse;
    const user = body.data?.user;
    // A private account still shows its picture, username and bio to anyone
    // who opens the profile — only posts and followers are behind the wall.
    // The picture was set knowing that, so it is not private information, and
    // this is only ever asked for about somebody the user already knows well
    // enough to have added.
    if (!user) return nothingFound;

    const imageUrl = user.profile_pic_url_hd || user.profile_pic_url;
    if (!imageUrl) return nothingFound;

    // Sent on as bytes rather than as a link. The CDN URL is signed and
    // expires, so a browser holding one would be showing a broken image by
    // tomorrow — and it would leak the signature to the page besides.
    const image = await fetch(imageUrl, { signal: controller.signal });
    if (!image.ok) return nothingFound;

    const length = Number(image.headers.get("content-length") ?? 0);
    if (length > maxImageBytes) return nothingFound;

    const bytes = await image.arrayBuffer();
    if (bytes.byteLength > maxImageBytes) return nothingFound;

    return new NextResponse(bytes, {
      headers: {
        "Content-Type": image.headers.get("content-type") ?? "image/jpeg",
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return nothingFound;
  } finally {
    clearTimeout(timeout);
  }
}
