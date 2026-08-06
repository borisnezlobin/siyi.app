/**
 * A person can be addressed by the uuid every older link carries or by the
 * readable slug the web app started minting in migration 0012, so both shapes
 * have to survive a deep link.
 */

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const personRoutePattern = /^\/people\/([a-z0-9][a-z0-9-]{0,119})$/i;
const reservedPersonSegments = ["new"];

export function looksLikeUuid(value: string) {
  return uuidPattern.test(value);
}

/** The identifier in `/people/<identifier>`, or null when the path is something else. */
export function personRouteIdentifier(path: string) {
  const identifier = personRoutePattern.exec(path)?.[1];
  if (!identifier) return null;
  if (reservedPersonSegments.includes(identifier.toLowerCase())) return null;
  return identifier;
}
