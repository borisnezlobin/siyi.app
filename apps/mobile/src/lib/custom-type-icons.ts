/**
 * Keys only, with no icon components, so server code and validation can name an
 * icon without importing a React icon library.
 */
export const customTypeIconKeys = [
  "sparkle",
  "confetti",
  "bowl",
  "film",
  "music",
  "book",
  "run",
  "climb",
  "game",
  "plane",
  "cart",
  "call",
  "health",
  "cake",
  "work",
  "art",
  "tent",
  "pet",
] as const;

export type CustomTypeIconKey = (typeof customTypeIconKeys)[number];

export function isCustomTypeIconKey(value: unknown): value is CustomTypeIconKey {
  return (
    typeof value === "string" &&
    (customTypeIconKeys as readonly string[]).includes(value)
  );
}
