/**
 * A person keeps the same colour everywhere, on both platforms. The colour
 * carries a little identity — you learn that Amara is the green one — which is
 * what makes a long alphabetical list scannable.
 */

export type AvatarColor = {
  background: string;
  ink: string;
};

export const avatarColors: AvatarColor[] = [
  { background: "#dfe9e2", ink: "#244f3b" },
  { background: "#f4dfc3", ink: "#75401f" },
  { background: "#dce6f2", ink: "#284f70" },
  { background: "#eedbd7", ink: "#7d3c34" },
  { background: "#e8dfef", ink: "#593d6b" },
];

export function avatarColorFor(name: string): AvatarColor {
  const total = Array.from(name).reduce(
    (sum, character) => sum + character.charCodeAt(0),
    0,
  );
  return avatarColors[total % avatarColors.length];
}

export function avatarInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}
