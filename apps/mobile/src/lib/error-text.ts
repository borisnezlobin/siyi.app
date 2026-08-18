/**
 * What a failure should say on screen.
 *
 * Screens used to render `error.message` straight through, so a dropped
 * connection read as "TypeError: Network request failed" and an expired session
 * as "JWT expired". Those are notes to a developer, and the rule for this app's
 * copy is that it is written for the person holding the phone.
 *
 * Messages the app wrote itself — "Sign in to see your people." — are already
 * in that voice and are passed through untouched. Only the ones that come from
 * the runtime, the network stack or Postgres get replaced.
 */

const technicalSignals = [
  /network request failed/i,
  /failed to fetch/i,
  /\bfetch\b.*\bfailed\b/i,
  /\bjwt\b/i,
  /\btoken\b.*\bexpired\b/i,
  /^[A-Za-z]*Error:/,
  /\bPGRST\d+\b/,
  /^\d{5}$/,
  /duplicate key|violates .* constraint|relation ".*" does not exist/i,
  /\b(?:ETIMEDOUT|ECONNREFUSED|ENOTFOUND|ECONNRESET)\b/,
  /statement timeout/i,
];

// Deliberately no bare /timeout/: Postgres answering "canceling statement due
// to statement timeout" is the server talking, not an absent network, and
// telling that reader they are offline sends them to check their signal.
const offlineSignals = [
  /network request failed/i,
  /failed to fetch/i,
  /\b(?:ETIMEDOUT|ECONNREFUSED|ENOTFOUND|ECONNRESET)\b/,
];

function looksTechnical(message: string) {
  return technicalSignals.some((pattern) => pattern.test(message));
}

function looksOffline(message: string) {
  return offlineSignals.some((pattern) => pattern.test(message));
}

export function readableError(error: unknown, fallback: string) {
  const message =
    error instanceof Error ? error.message.trim() : String(error ?? "").trim();

  if (!message) return fallback;
  // Worth naming, because it is the one the reader can do something about.
  if (looksOffline(message)) {
    return "No connection. This will load when you are back online.";
  }
  if (looksTechnical(message)) return fallback;
  return message;
}
