# Siyi

A personal CRM for the people you meet. Next.js on the web (repo root), Expo in
`apps/mobile`.

## Rules

**Never use all-uppercase text.** No `uppercase` Tailwind class, no
`textTransform: "uppercase"`, no `.toUpperCase()` for display. Section headings,
eyebrows and labels are written in sentence case. Uppercase reads as generated
copy. Initials in avatars are the one exception, because a single letter has no
case to read.

**Both apps, always.** A feature belongs on web and mobile unless it is
physically impossible on one (device contacts, push permissions). The two should
not differ in what they can do, and should differ as little as possible in how
they look. The apps keep parallel copies of shared logic — `birthday-age.ts`,
`contact-methods.ts`, `people-filters.ts` and friends exist in both `src/lib`
and `apps/mobile/src/lib`. Change both.

**Renames are not find-and-replace.** Strings that look like copy are often not:
fetch paths, persisted values in the offline queue, notification deduplication
keys, object keys matched against route names. Rename what a user reads; leave
identifiers alone unless you have checked every side of them.

**The bundled data files are generated.** `colleges-data.ts` comes from
`scripts/build-college-dataset.mjs`, `place-table.ts` and `world-outline.ts`
likewise. Never hand-edit them, and never hand-write entries into the generator
— if the data is wrong, fix it from the source.
