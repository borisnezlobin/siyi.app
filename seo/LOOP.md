# The Search Console loop

The bi-weekly agent run. This file is the agent's brief; `progress.md` is its
memory. Both are read at the start of every run.

## Prerequisite

**Do not run this until Search Console has at least four weeks of data.**
`www.siyi.app` is verified and the sitemap is submitted, but a property with no
impressions produces confident nonsense — an agent asked to find rising queries
in an empty dataset will invent them. Check that the last 28 days show
impressions before the first real run.

## What the run does

1. Read `progress.md` in full — every section, not just the most recent.
2. Pull from Search Console over MCP (`mcp-gsc`), last 28 days and the 28 days
   before that:
   - queries by impressions, clicks, CTR and average position
   - pages by the same
   - coverage: which submitted URLs are indexed
3. Decide what changed, what moved, and what did not.
4. Propose changes as a **pull request**.
5. Append a dated section to `progress.md`: what changed, what moved, what did
   not, what to try next, and which queries were deliberately ignored.

## What it may change

- Titles and descriptions in `src/lib/public-pages.ts`
- Body copy in the marketing pages under `src/app/(marketing routes)`
- Internal links between existing content pages
- FAQ entries in `src/lib/faq.ts`
- New content pages, subject to the cap below

## What it may never change

- `src/app/robots.ts` and `src/app/sitemap.ts` — both are derived from
  `publicPages`; an agent editing them directly is an agent breaking the
  mechanism that keeps the three lists in sync
- Anything under `src/app/(app)`, `src/lib/supabase`, or `supabase/migrations`
- `src/config/brand.ts`
- Any test file, to make a failing test pass

## Hard rules

**It opens a pull request. It does not deploy.** The tweet this loop is modelled
on had the agent `git pull` and restart the server itself. One bad automated
commit into the marketing site during launch week is not something a cron can
undo.

**Two new pages per run, maximum.** This is the single line that keeps the loop
out of scaled content abuse — the failure mode that took 50–80% of traffic off
sites publishing templated pages at scale in the March 2026 core update. If a
run wants to write five pages, it writes the two best and records the other
three in `progress.md` as candidates.

**A page that could be produced by substituting a variable into a template does
not ship.** Not a style preference: templated-at-scale is precisely what the
policy targets, and the policy is method-agnostic about whether a human or a
model wrote it.

**Every run reports what it ignored.** Queries it saw and chose not to act on go
in `progress.md` by name. A loop that silently narrows its own scope looks
identical to a loop that has run out of ideas.

**Never edit a page to match a query the page is not about.** Rewriting
`/vs/monica` to chase an unrelated rising keyword destroys the page's reason to
exist and is how automated SEO turns a real site into a doorway farm.

## Cadence

Bi-weekly. Search Console data is noisy at a weekly grain for a site this size,
and two weeks is long enough for a change from the previous run to show up in
the data the next run reads.
