# SEO loop progress

This file is the loop's entire memory. Every run appends a dated section; the
next run reads the whole file before deciding anything. Nothing else carries
state between runs, so a change that is not written down here did not happen.

Append, never rewrite. A wrong guess from three runs ago is worth more than a
tidy file — it is the only record of what has already been tried.

---

## Baseline — 2026-08-16 (written by hand, before the first run)

**State of the site.** `www.siyi.app` is verified in Search Console. The site
has just gained an entity foundation and its first content pages; before this
there were six public pages, no structured data, and no canonical tags.

Public pages now: `/`, `/faq`, `/reviews`, `/for/college-students`,
`/for/clubs`, `/for/networking-events`, `/vs/dex`, `/vs/monica`, `/vs/notion`,
plus `/privacy`, `/terms`, `/support`, `/team`.

**What was changed, and why.**

- Canonical URLs on every public page. There were none, so nothing told Google
  which URL to prefer.
- The home page title now leads with the brand: searching "siyi app for people"
  returned `/terms` over the home page, and the home title never said the brand.
- `Organization` / `WebSite` / `SoftwareApplication` JSON-LD, carrying
  `alternateName: "Siyi app"` — the exact phrasing that failed.
- `/llms.txt`, generated from the sitemap so the two cannot disagree.

**Known open questions for the loop to answer with data.**

- Does the home page win its own brand query once the canonical and the entity
  markup are indexed? This is the first thing to check, not a keyword play.
- Which of the three `/for/` pages picks up impressions first? That says which
  audience framing actually matches how students search.
- Do the `/vs/` pages get impressions on competitor-brand queries, and at what
  position?

**Not yet tried.** Everything. This is the baseline.

**Action points for the first real run.**

1. Confirm all thirteen public pages are indexed. An unindexed page is not a
   ranking problem and must not be treated as one.
2. Report queries with impressions and no matching page — those are the
   evidence for what to write next.
3. Do not propose new pages in the first run. Establish what exists first.

---

## Setup correction — 2026-08-29 (written by hand, still before the first run)

**The baseline's date is not the date crawling could start.** The 2026-08-16
entry describes thirteen public pages as the state of the site. They were
written then, but they were not reachable: the work sat unmerged on
`fix/pwa-responsiveness-and-staleness` while `main` served six public pages. The
content pages went live on 2026-08-26, verified by the sitemap listing all
thirteen and each page answering 200.

So the four-week clock in `LOOP.md` starts on 2026-08-26, not 2026-08-16. The
earliest honest first run is **2026-09-23**. A run before that reads a window
that is mostly pre-launch and concludes things about pages Google had not yet
seen.

**How the data arrives now.** `mcp-gsc` was never configured; it is now
registered locally, and a scheduled run — which happens where no local MCP
server exists — uses `scripts/fetch-search-console.mjs` and a service account
instead. Both read the same property.

**One rule changed.** The loop may now merge its own pull request when every
check passes, where before it always stopped at the pull request. The reasoning
and its limits are in `LOOP.md`; it is recorded here because a rule that changes
silently is indistinguishable from a rule an agent talked itself out of.

**Still open.** The service account key does not exist yet, so the first run
cannot fetch anything until it does.
