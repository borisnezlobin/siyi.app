import { createHmac, timingSafeEqual } from "node:crypto";

const TOKEN_SEPARATOR = ".";

function unsubscribeSecret() {
  const secret =
    process.env.UNSUBSCRIBE_SECRET?.trim() || process.env.CRON_SECRET?.trim();

  if (!secret) {
    throw new Error("UNSUBSCRIBE_SECRET or CRON_SECRET must be configured.");
  }

  return secret;
}

function encode(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function decode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function signUserId(userId: string) {
  return createHmac("sha256", unsubscribeSecret())
    .update(userId)
    .digest("base64url");
}

function signaturesMatch(expected: string, provided: string) {
  const expectedBytes = Buffer.from(expected, "utf8");
  const providedBytes = Buffer.from(provided, "utf8");

  // timingSafeEqual throws on length mismatch, so compare a fixed-width digest
  // of each side instead of returning early on the length.
  const expectedDigest = createHmac("sha256", "length-guard")
    .update(expectedBytes)
    .digest();
  const providedDigest = createHmac("sha256", "length-guard")
    .update(providedBytes)
    .digest();

  return timingSafeEqual(expectedDigest, providedDigest);
}

export function createUnsubscribeToken(userId: string) {
  return `${encode(userId)}${TOKEN_SEPARATOR}${signUserId(userId)}`;
}

export function verifyUnsubscribeToken(token: string): string | null {
  const segments = token.split(TOKEN_SEPARATOR);
  if (segments.length !== 2) return null;

  const [encodedUserId, providedSignature] = segments;
  if (!encodedUserId || !providedSignature) return null;

  const userId = decode(encodedUserId);
  if (!userId || encode(userId) !== encodedUserId) return null;

  return signaturesMatch(signUserId(userId), providedSignature) ? userId : null;
}

export function buildUnsubscribeUrl(userId: string) {
  const baseUrl = (
    process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
  ).replace(/\/$/, "");

  return `${baseUrl}/api/unsubscribe?token=${encodeURIComponent(createUnsubscribeToken(userId))}`;
}
