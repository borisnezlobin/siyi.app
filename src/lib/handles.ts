/**
 * A public handle is a readable name plus a short tag: `alex.vale#4f21`.
 *
 * The tag is the point. Without it a handle is guessable from somebody's name,
 * and a page anyone can load becomes a page anyone can find. Four hex characters
 * is 65,536 tags per name — trivial to read aloud, tedious to enumerate — and
 * the name half stays human so it can be said in a sentence.
 */

export const handlePattern = /^[a-z0-9](?:[a-z0-9._-]{1,28}[a-z0-9])$/;
export const handleTagPattern = /^[0-9a-f]{4}$/;
export const handleMaxLength = 30;

/** Reserved because a profile at these addresses would shadow a real page. */
const reservedHandles = new Set([
  "about", "admin", "api", "auth", "birthdays", "check-in", "help", "legal",
  "login", "map", "me", "new", "people", "privacy", "reminders", "s", "settings",
  "signup", "support", "terms", "today", "www",
]);

export function normalizeHandle(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9._-]/g, "")
    .slice(0, handleMaxLength);
}

export type HandleProblem =
  | "too-short"
  | "too-long"
  | "bad-characters"
  | "reserved";

export function handleProblem(value: string): HandleProblem | null {
  const handle = normalizeHandle(value);
  if (handle.length < 3) return "too-short";
  if (handle.length > handleMaxLength) return "too-long";
  if (!handlePattern.test(handle)) return "bad-characters";
  if (reservedHandles.has(handle)) return "reserved";
  return null;
}

export const handleProblemMessages: Record<HandleProblem, string> = {
  "too-short": "Handles are at least 3 characters.",
  "too-long": `Handles are at most ${handleMaxLength} characters.`,
  "bad-characters":
    "Letters, numbers, dots, dashes and underscores, starting and ending with a letter or number.",
  reserved: "That one is taken by the app itself. Try another.",
};

/** `randomBytes` is passed in because Node and React Native disagree on where it lives. */
export function createHandleTag(randomBytes: (size: number) => Uint8Array): string {
  const bytes = randomBytes(2);
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function formatHandle(handle: string, tag: string) {
  return `${handle}#${tag}`;
}

export function profilePath(handle: string, tag: string) {
  // The tag rides in the path rather than as a fragment, which never reaches
  // the server, or a query, which gets stripped when links are shared around.
  return `/@${handle}-${tag}`;
}

export function buildProfileUrl(baseUrl: string, handle: string, tag: string) {
  return `${baseUrl.replace(/\/+$/, "")}${profilePath(handle, tag)}`;
}

/** Splits `alex.vale-4f21` back apart. Anything else is not a profile. */
export function parseProfileSlug(
  slug: string,
): { handle: string; tag: string } | null {
  const match = /^(.+)-([0-9a-f]{4})$/.exec(slug.trim().toLowerCase());
  if (!match) return null;
  const [, handle, tag] = match;
  if (handleProblem(handle)) return null;
  return { handle, tag };
}
