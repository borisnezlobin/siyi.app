const INSTAGRAM_HOSTS = new Set([
  "instagram.com",
  "www.instagram.com",
  "m.instagram.com",
]);

export function normalizeInstagramUsername(value: string): string {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return "";
  }

  const candidateUrl = trimmedValue.match(/^https?:\/\//i)
    ? trimmedValue
    : trimmedValue.includes("instagram.com/")
      ? `https://${trimmedValue}`
      : null;

  if (candidateUrl) {
    try {
      const parsedUrl = new URL(candidateUrl);
      if (INSTAGRAM_HOSTS.has(parsedUrl.hostname.toLowerCase())) {
        return (
          parsedUrl.pathname.split("/").filter(Boolean)[0]?.toLowerCase() ?? ""
        );
      }
    } catch {
      return "";
    }
  }

  return trimmedValue
    .replace(/^@+/, "")
    .split(/[/?#]/)[0]
    .trim()
    .toLowerCase();
}
