import { brand } from "@/config/brand";

/**
 * The pages a stranger can open without signing in. Each page's `metadata` and
 * its Open Graph image both read from here, so the title a crawler indexes and
 * the title drawn into the share card can never drift apart.
 */
export const publicPages = {
  home: {
    path: "/",
    title: "Remember the people who matter",
    description:
      "Capture the people you meet in college, remember the context, and reconnect when the time feels right.",
  },
  privacy: {
    path: "/privacy",
    title: "Privacy policy",
    description: `How ${brand.name} collects, uses, protects, and deletes personal information.`,
  },
  terms: {
    path: "/terms",
    title: "Terms of service",
    description: `The terms for using ${brand.name}.`,
  },
  support: {
    path: "/support",
    title: "Support",
    description: `Get help with ${brand.name}.`,
  },
  auth: {
    path: "/auth",
    title: "Sign in",
    description: `Use email, Apple, or Google to get back to your people on ${brand.name}.`,
  },
} as const;

export type PublicPageKey = keyof typeof publicPages;

export type PublicPage = (typeof publicPages)[PublicPageKey];

export const publicPagePaths = Object.values(publicPages).map(
  (page) => page.path,
);

/**
 * Next inherits a parent segment's whole `openGraph` object when a page does not
 * declare one, so each public page restates its own title and description here
 * rather than silently sharing the root's.
 */
export function publicPageMetadata(key: PublicPageKey) {
  const page = publicPages[key];

  return {
    title: page.title,
    description: page.description,
    openGraph: {
      title: page.title,
      description: page.description,
      url: page.path,
    },
    twitter: {
      title: page.title,
      description: page.description,
    },
  } as const;
}
