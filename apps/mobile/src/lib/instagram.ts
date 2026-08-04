export function normalizeInstagramUsername(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";

  try {
    const withProtocol = /^https?:\/\//i.test(trimmed)
      ? trimmed
      : `https://${trimmed}`;
    const parsed = new URL(withProtocol);
    if (
      parsed.hostname === "instagram.com" ||
      parsed.hostname.endsWith(".instagram.com")
    ) {
      return parsed.pathname.split("/").filter(Boolean)[0]?.toLowerCase() || "";
    }
  } catch {
    return trimmed.replace(/^@/, "").toLowerCase();
  }

  return trimmed.replace(/^@/, "").toLowerCase();
}
