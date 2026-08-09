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

**Never add backwards compatibility unless asked.** No fallback stores, no
legacy-format readers, no "works before the migration runs" paths. The project
is in development: the schema and the client ship together, so a migration is
simply run. Compatibility layers are cheap to write and expensive to live with —
ask first.

**Renames are not find-and-replace.** Strings that look like copy are often not:
fetch paths, persisted values in the offline queue, notification deduplication
keys, object keys matched against route names. Rename what a user reads; leave
identifiers alone unless you have checked every side of them.

**The bundled data files are generated.** `colleges-data.ts` comes from
`scripts/build-college-dataset.mjs`, `place-table.ts` and `world-outline.ts`
likewise. Never hand-edit them, and never hand-write entries into the generator
— if the data is wrong, fix it from the source.

**A sheet's primary action lives in its footer.** `AppBottomSheet` takes a
`footer`, which the library pins above the keyboard. A save button placed inside
the scrolling content instead can sit below the fold with nothing to say it is
there, and padding cannot lift it — that bug was fixed four times before the
mechanism was the thing that changed. For the same reason every text input
inside a sheet goes through `FormField … bottomSheet`: a plain `TextInput` never
registers with the sheet, so the sheet never knows to move.

**Never use the iOS simulator.** Do not run `expo run:ios`, `npm run mobile:ios`,
or anything else that boots, installs to, or downloads a simulator — the runtimes
are gigabytes and the visual check is not yours to make. Verification on the
phone side is `tsc`, `jest`, `eslint` and `expo export`, which proves the bundle
builds; anything about how it looks or feels is reported by whoever is holding
the device. When native code changes, say that a rebuild is needed and let them
run it.
