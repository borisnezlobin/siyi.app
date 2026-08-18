import { brand } from "@/config/brand";
import { absoluteUrl } from "@/lib/site-url";

/**
 * The pages a stranger can open without signing in. Each page's `metadata` and
 * its Open Graph image both read from here, so the title a crawler indexes and
 * the title drawn into the share card can never drift apart.
 *
 * `title` is the human one: it is drawn into the share card, which prints the
 * brand name above it already, so putting the brand in here would say it twice.
 * `searchTitle` is the `<title>` when those two want different things — the home
 * page needs to lead with the name a person typed into Google, the card does
 * not.
 */
export const publicPages = {
  home: {
    path: "/",
    title: "Stay close to the people you just met",
    // Absolute, so the `%s · Siyi.app` template does not append the brand to a
    // title that already opens with it. Searching "siyi app" returned /terms
    // over this page, and a home page whose title never says the brand is the
    // reason a crawler had nothing better to offer.
    searchTitle: `${brand.name} — remember the people you meet in college`,
    description:
      "Write one sentence the day you meet someone. Siyi remembers the birthday, the favor you promised, and the friend you have not spoken to since October, and brings each of them up when it matters.",
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
  team: {
    path: "/team",
    title: "The team",
    description: `${brand.name} is built by a small group of college students in Berkeley.`,
  },
  auth: {
    path: "/auth",
    title: "Sign in",
    description: `Use email, Apple, or Google to get back to your people on ${brand.name}.`,
  },
  faq: {
    path: "/faq",
    title: "Questions people ask",
    description: `What ${brand.name} is, what it costs, what happens to your notes, and whether the people you add ever find out.`,
  },
  reviews: {
    path: "/reviews",
    title: "What people say",
    description: `Reviews from people using ${brand.name}, published by the team that makes it.`,
  },
  forCollegeStudents: {
    path: "/for/college-students",
    title: "A personal CRM for college students",
    description:
      "You meet more people in your first month of college than in the four years before it. Siyi is built for keeping hold of them.",
  },
  forClubs: {
    path: "/for/clubs",
    title: "Remembering everyone in the club",
    description:
      "Forty new faces at the first meeting and a name you were too embarrassed to ask twice. How to keep track without a spreadsheet.",
  },
  forNetworkingEvents: {
    path: "/for/networking-events",
    title: "After the career fair",
    description:
      "The follow-up is the whole point of a networking event, and it is the part everyone drops. What to write down before you leave the room.",
  },
  vsDex: {
    path: "/vs/dex",
    title: "Siyi.app vs Dex",
    description:
      "Dex is a networking CRM for professionals with a LinkedIn network to manage. Siyi is for the people around you right now. How the two differ.",
  },
  vsMonica: {
    path: "/vs/monica",
    title: "Siyi.app vs Monica",
    description:
      "Monica is an open-source personal CRM you can self-host. Siyi is a free app that works on your phone the day you install it. How to pick.",
  },
  vsNotion: {
    path: "/vs/notion",
    title: "Siyi.app vs a Notion contacts database",
    description:
      "Everyone tries the Notion table first. Here is exactly where it breaks down, and what a purpose-built app does instead.",
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
  // Only the home page overrides its own `<title>`, and `absolute` is what stops
  // the root layout's `%s · Siyi.app` template appending the brand twice.
  const searchTitle =
    "searchTitle" in page ? { absolute: page.searchTitle } : page.title;

  return {
    title: searchTitle,
    description: page.description,
    // Without this nothing on the site declared which URL it wanted to be. www
    // and the bare domain, and the same page reached with a query string, all
    // looked like separate pages worth choosing between.
    alternates: { canonical: absoluteUrl(page.path) },
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
