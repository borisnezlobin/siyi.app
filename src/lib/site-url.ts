/**
 * The one place the public origin is decided. The sitemap, robots, the canonical
 * tag and the JSON-LD entity all have to agree on it: a crawler that sees the
 * site call itself three different things picks one and it is rarely the one you
 * wanted.
 */
export const siteUrl =
  process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "") ||
  "https://www.siyi.app";

export function absoluteUrl(path: string) {
  return path === "/" ? siteUrl : `${siteUrl}${path}`;
}
