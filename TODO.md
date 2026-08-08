# Siyi backlog

Working file. Delete entries as they ship. Ordered by launch risk.

> Deploys no longer have to wait for migrations. Code that reads schema which
> may not exist yet degrades to empty; code that writes it retries without the
> pending columns (`src/lib/pending-columns.ts`). Running a migration turns its
> feature on — nothing breaks in the meantime. Keep it that way.

## Done (shipped and live)

- [x] Marketing consent, signed unsubscribe token, one-click unsubscribe
- [x] Discard-changes confirmation on edited profiles (web + mobile)
- [x] Editable "first met" date; backdateable updates
- [x] Updates card owns the add action; compact reminder box moved right
- [x] www.siyi.app canonical in code
- [x] Relationship labels in your own words; reminders opt-out (migration 0008)

- [x] Signup crash: `notification_preferences_user_id_key` duplicate key
- [x] Test notification collapsed every failure into an opaque 500
- [x] Notification status message stranded at the bottom of the page
- [x] Update not appearing until manual reload; save failures silently ignored
- [x] Phone number auto-formatting (web + mobile)
- [x] Preview person renamed Maya -> Amelia
- [x] Settings: reminder section renamed and levels labelled by name
- [x] Settings: external-link icon on an internal link
- [x] Settings: account card flattened, email shown, sign out toned down
- [x] Settings: import/export moved to just before delete account
- [x] Home screen (PWA) install hint with per-platform steps, no jargon
- [x] Email links use token_hash so scanners stop consuming them
- [x] Web shows person updates, merged and de-duplicated with interactions
- [x] Logo reworked (rotated square), favicon rounded
- [x] not-found, error, robots, sitemap

## P0 — before launch

- [x] **Push notifications failing for real users.** Root cause: migration
      0004 was never applied, so `native_push_subscriptions` does not exist.
      `sendPushToUser` ran web and phone delivery in one `Promise.all`, so the
      missing phone table rejected the whole send and browser push failed with
      "Could not find the table 'public.native_push_subscriptions'". The same
      missing table was also breaking data export for every user. Both now
      tolerate it. Applying 0004 is still worth doing before the phone app
      ships, but nothing is blocked on it.
- [x] **Edit an update after saving it.** Edit and delete for both timeline
      sources, no migration needed. Two ordering rules matter:
      editing writes the linked `interactions` rows first, because they carry
      the date reminders measure from, so a half-failed save leaves stale text
      rather than a reminder pointing at an invisible date; deleting removes
      those rows first, because the foreign key only nulls `source_update_id`
      and the interaction would otherwise reappear as its own entry. Both
      orders are safe to retry.

## P1 — UX that users tripped on

- [x] **Person picker does not scale.** Replaced the dropdown with a ranked
      typeahead: name-start beats word-start beats substring, ties broken by
      who was seen most recently, capped at 8. Accent- and case-insensitive,
      arrow-key navigable. Reusable as `PersonPicker`.
- [x] **Custom "Other" update type** with a user-supplied label and a Phosphor
      icon from a fixed set. NOT emoji — the owner ruled emoji out as icon
      substitutes. Anything not in the set is dropped at validation rather
      than stored and rendered as nothing. Labels the user has already written
      are offered back as one-tap suggestions. Needs migration 0009; until it
      runs the label is silently dropped and the type saves as plain "Other".

## P2 — features requested

- [ ] **Admin at /admin** for Boris and Jerry only. Anonymised: user count,
      contacts-per-user distribution, retention. Plus targeted announcements
      and push to segments ("all users", "users with 100+ contacts").
- [ ] **Multiple emails / phones / Instagram handles per person.** Schema
      change: child tables or JSONB. Touches import/export, vCard, contact
      sync, and search.
- [ ] **Named note sections** (supersedes the "bigger textarea" idea, which
      the owner correctly rejected). The real need: the same headings reused
      across many people — "Interests", "Things we've done together",
      "Things mentioned".
      Schema: `person_notes` (id, user_id, person_id, heading, body, position).
      No separate templates table — instead suggest headings this user has
      already used, which gives reuse for free. Keep `people.general_notes`
      as an untitled first section; do not migrate or drop it.
      Markdown and per-person custom *fields* both rejected.

- [ ] **Edit Person page is far too long.** Group it, do not just reorder:
      - "Who they are" — photo, name, preferred name
      - "How to reach them" — phone, email, Instagram
      - "About them" — hometown, major, graduation year, dorm
      - "How you met" — first met date and location
      - "Notes" — the named sections above
      - "Reminders" — relationship label and the reminder switch
      Collapsed by default except the section being edited. Avoid the phrase
      "basic info" — the owner dislikes it.
- [ ] **Map of hometowns / locations.** Needs geocoding. Possible paid tier.
- [ ] **Cleaner person URLs** — `/people/boris-nezlobin` instead of a uuid.
      ALWAYS append the suffix, never only on collision: a conditional suffix
      leaks whether another user already has a person by that name. Keep the
      uuid resolving forever.

## Mobile parity — the rule going forward

The phone app ships everything the web ships, in the same change. Skipping it
because the offline queue is awkward is how it fell behind in the first place.

- [x] Note sections, multiple contact methods, edit/delete updates, custom
      "Other" type, and the person typeahead all now exist on the phone, with
      offline queueing and conflict rules for each.
- Conflict rules chosen, worth knowing: a queued edit that lands on a row
      somebody already changed KEEPS BOTH rather than picking a winner. A
      queued delete is honoured unconditionally — the one accepted data-loss
      path, because the user confirmed deleting that specific entry and an
      offline phone has no way to ask again.
- Visible change for existing phone users: the composer's free-text "What
      kind?" box is replaced by the web's nine-type grid plus Other-with-a-name.
      Labels already typed still read back, mapped to Other.
- [x] Person detail section headers, people rows and relative dates now match.
      Every section action carries a label — no clock or arrow-out-of-box to
      decode — and Reminders and History use one pattern on both platforms.
      The tinted circular icon button is gone from the codebase (the
      `compact` variant of `QuickCaptureTrigger` was deleted along with
      `quick-interaction-sheet.tsx`, which was its only other home).
      Avatars are per-person coloured on both, from `avatar-colors.ts`.
      All relative wording lives in `relative-time.ts`, mirrored into both
      apps, and it counts calendar days rather than elapsed hours.
      Every "Due in N days" now carries the date it lands on.
- Known gap: no simulator or device run. Mobile UI is covered by
      @testing-library/react-native, not by a real device.
- Running mobile jest from an agent worktree needs
      `apps/mobile/node_modules` symlinked from the main checkout — Node
      resolution walks up to the root but never reaches the workspace folder.
- [x] Announcements now reach the phone. Until this landed the phone had no
      announcement handling at all, so a banner published from /admin was seen
      by web users only. Same endpoint, and the dismissal is recorded
      server-side, so dismissing on the phone also clears it on the web.
      Deliberate difference: the web mounts the banner in the shell, above
      every page; the phone mounts it on Today only. Putting it above the
      native Stack would have fought every screen's own safe-area padding,
      and Today is where the app opens.
- [x] /admin is no longer web-only. Same aggregates, same segment picker,
      same two-step publish and separate push. It is deliberately unlisted on
      both platforms — nothing links to it, the web is reached by typing the
      URL and the phone by deep link (`siyi://admin`, confirmed present in
      expo-router's generated route table). A non-admin gets "This page does
      not exist" rather than a locked page, because every admin endpoint
      answers 404 rather than 403.
      The phone talks to the existing `/api/admin/*` routes with its Supabase
      access token, so no admin logic and no service-role key is duplicated
      into the app binary.
- [x] Catch-up is no longer phone-only. Web gets the same three phases in a
      dialog off Today: the picked person with what you saved and a few
      openings, choosing someone else, and choosing how to say hello.
      `catch-up.ts` is a byte-identical copy of the phone's, so the person
      picked and the openings offered match. `contact-links.ts` is web-only
      and deliberately different: a browser cannot be asked whether it can
      open `instagram://` and told to fall back, so the web always takes the
      https route. The on-device Apple Intelligence starters stay phone-only
      — the fallback starters are what web shows, which is what the phone
      shows too whenever the model declines.
- Shared-element transitions (People row → profile) do NOT work on this
      stack, and the entrance in `profile-intro.ts` is what stands in for
      them. Reanimated 4.5.1 still exports `sharedTransitionTag` and
      `SharedTransition`, and `staticFeatureFlags.ENABLE_SHARED_ELEMENT_TRANSITIONS`
      really does reach the compiler (verified in `RNReanimated.debug.xcconfig`
      after `pod install`, and native-rebuilt), but the props are inert on the
      New Architecture: `FeatureFlags::getFlag` is consumed by `if constexpr`
      in `ReanimatedModuleProxy.cpp`, and a probe screen with a deliberate
      20-second `SharedTransition.duration(20000)` finished in ~1.4s with the
      avatar already at its destination size in the first post-push frame —
      i.e. the ordinary stack push. Don't re-attempt without a Reanimated
      upgrade that lists it as restored.

## Ops / not code

- [ ] Re-paste the five email templates into Supabase (they changed to
      token_hash).
- [ ] Raise the OTP expiry in Supabase Auth.
- [ ] Make `www.siyi.app` canonical; point the Vault cron URL at it.
- [ ] Enable Apple and Google providers.
- [ ] Set `APPLE_TEAM_ID` so universal links resolve.
- [ ] Resend: verify a sending subdomain for marketing mail.
- [ ] iOS build needs an Apple Developer account (18+). Blocked.

## Applied migrations

Nothing in this repo applies migrations automatically. Run these in order
against production; both are additive and touch no existing data:

- `0004_native_push_subscriptions.sql` — NOT APPLIED. This was the cause of
  the push and export failures. No longer urgent (the code copes), but the
  phone app cannot register for notifications until it runs.
- `0007_marketing_consent.sql` — NOT YET APPLIED. The marketing toggle in
  settings does nothing until it is.
- `0009_custom_interaction_labels.sql` — NOT YET APPLIED. Adds custom_label
  and custom_icon to interactions. Until it runs, naming an "Other" update
  silently does nothing.
- `0008_relationship_labels.sql` — NOT YET APPLIED. Adds relationship_label
  and reminders_enabled, and replaces the create-person RPC. Until it runs,
  relationship labels silently do not persist and every person gets reminders.

## Merged, awaiting migrations

- [x] **/admin** — allowlisted, anonymised stats, segment announcements + push.
      Hardened after review: signup is open, so an email allowlist only held
      while Supabase was confirming addresses. `ADMIN_USER_IDS` now wins when
      set; the email path additionally requires a confirmed address.
      Known caveat, judged acceptable: the `announcements` select policy lets
      any signed-in user read any live announcement. Segment targeting is
      enforced in the API, not in SQL. Broadcast copy, no personal data.
- [x] **Named note sections** + Edit Person grouped into six collapsibles.
      Mobile deliberately untouched — its form is offline-first with a sync
      queue, so sections there need new sync entities. Separate task.
      Rough edge: a section left dirty is lost on Cancel without a warning.
- [x] **Cleaner person URLs** — always-suffixed slugs, uuid resolves forever.
      A rename does NOT regenerate the slug; the suffix carries the
      disambiguation and a stale name portion costs nothing.
      Not done: push notification URLs still carry the uuid, because the cron
      selects an explicit column list and adding `slug` would fail the whole
      nightly run until 0012 is applied. The uuid redirects, so the result is
      already correct for users.
      UNVERIFIED: the SQL in 0012 has never run. `normalize(…, nfkd)`, the
      `U&'[\0300-\036F]'` escape and `person_slug_suffix` are worth an eyeball
      before applying.

- [x] **Map of hometowns.** Offline gazetteer, no dependency, no request at
      render — hometowns never leave the server. GeoNames cities15000 (1.4 MB,
      ~34k cities, CC BY 4.0) plus Natural Earth outlines (108 KB, public
      domain), both server-only, so /map ships 0 B of page JavaScript.
      Ambiguous names resolve to NOTHING and are listed as unplaced:
      Cambridge, San Jose, Springfield, Georgia, Washington. Add a state and
      they resolve. Region matches are drawn hollow and labelled approximate.
      No migration: the resolver is a pure hash lookup, so there is no 0014.
      Not tested: the unplaced and no-hometown sections never rendered with
      real data, and it has never run against a real Supabase dataset.

- [x] **Multiple emails / phones / Instagram handles.** Child table
      `person_contact_methods`, migration 0013. The three columns on `people`
      stay as a denormalised cache of the primary, because export, contact
      sync, search and the phone app all still read them — dropping them is a
      separate job. With one row the form is byte-for-byte today's single box,
      so adding a person did not get slower.
      Deliberate behaviour change even pre-migration: contact matching used to
      take the FIRST device contact holding a matching number and now refuses
      when two match. That is the "never guess" rule, but it is a change for
      single-number people too.
      Still one value per kind on mobile — rewriting that form plus its offline
      mutation queue was judged too risky here. A mobile edit mirrors into the
      child table so the web never shows a stale number.
      NOT verified against a real database: the backfill's idempotence is
      asserted structurally, not by running it twice. Run 0013 on a copy first.

## Ops / not code

- [ ] Re-paste the five email templates into Supabase (they changed to
      token_hash).
- [ ] Raise the OTP expiry in Supabase Auth.
- [ ] Make `www.siyi.app` canonical; point the Vault cron URL at it.
- [ ] Enable Apple and Google providers.
- [ ] Set `APPLE_TEAM_ID` so universal links resolve.
- [ ] Resend: verify a sending subdomain for marketing mail.
- [ ] iOS build needs an Apple Developer account (18+). Blocked.

## Applied migrations

Nothing in this repo applies migrations automatically. Run these in order
against production; both are additive and touch no existing data:

- `0004_native_push_subscriptions.sql` — NOT APPLIED. This was the cause of
  the push and export failures. No longer urgent (the code copes), but the
  phone app cannot register for notifications until it runs.
- `0007_marketing_consent.sql` — NOT YET APPLIED. The marketing toggle in
  settings does nothing until it is.
- `0009_custom_interaction_labels.sql` — NOT YET APPLIED. Adds custom_label
  and custom_icon to interactions. Until it runs, naming an "Other" update
  silently does nothing.
- `0008_relationship_labels.sql` — NOT YET APPLIED. Adds relationship_label
  and reminders_enabled, and replaces the create-person RPC. Until it runs,
  relationship labels silently do not persist and every person gets reminders.

## Merged, awaiting migrations

- [x] **/admin** — allowlisted, anonymised stats, segment announcements + push.
      Hardened after review: signup is open, so an email allowlist only held
      while Supabase was confirming addresses. `ADMIN_USER_IDS` now wins when
      set; the email path additionally requires a confirmed address.
      Known caveat, judged acceptable: the `announcements` select policy lets
      any signed-in user read any live announcement. Segment targeting is
      enforced in the API, not in SQL. Broadcast copy, no personal data.
- [x] **Named note sections** + Edit Person grouped into six collapsibles.
      Mobile deliberately untouched — its form is offline-first with a sync
      queue, so sections there need new sync entities. Separate task.
      Rough edge: a section left dirty is lost on Cancel without a warning.
- [x] **Cleaner person URLs** — always-suffixed slugs, uuid resolves forever.
      A rename does NOT regenerate the slug; the suffix carries the
      disambiguation and a stale name portion costs nothing.
      Not done: push notification URLs still carry the uuid, because the cron
      selects an explicit column list and adding `slug` would fail the whole
      nightly run until 0012 is applied. The uuid redirects, so the result is
      already correct for users.
      UNVERIFIED: the SQL in 0012 has never run. `normalize(…, nfkd)`, the
      `U&'[\0300-\036F]'` escape and `person_slug_suffix` are worth an eyeball
      before applying.

- [x] **Map of hometowns.** Offline gazetteer, no dependency, no request at
      render — hometowns never leave the server. GeoNames cities15000 (1.4 MB,
      ~34k cities, CC BY 4.0) plus Natural Earth outlines (108 KB, public
      domain), both server-only, so /map ships 0 B of page JavaScript.
      Ambiguous names resolve to NOTHING and are listed as unplaced:
      Cambridge, San Jose, Springfield, Georgia, Washington. Add a state and
      they resolve. Region matches are drawn hollow and labelled approximate.
      No migration: the resolver is a pure hash lookup, so there is no 0014.
      Not tested: the unplaced and no-hometown sections never rendered with
      real data, and it has never run against a real Supabase dataset.

## In flight

Migration numbers are reserved per agent so they cannot collide:

- `0010_person_notes.sql` — named note sections + Edit Person page grouping.
  Also builds "How to reach them" as its own component, which the
  multiple-contacts task below is meant to extend.
- `0011_admin_announcements.sql` — /admin, allowlisted by `ADMIN_EMAILS`,
  anonymised aggregate stats, segment announcements and push.
- `0012_person_slugs.sql` — always-suffixed person slugs, uuid keeps resolving.
- `0014_person_coordinates.sql` — hometown map, offline dataset only, no new
  dependency and no external requests.

Queued, NOT started — it rewrites the same contact fields agent 0010 is
restructuring, so it must run after that lands:

- [ ] **Multiple emails / phones / Instagram handles per person.** Child
      tables. Touches import/export, vCard, contact sync, and search.

Rules every agent was given, worth keeping for the next one:
no `npm install` (worktrees resolve node_modules from the repo root, and a
concurrent install corrupts the shared npm cache); additive migrations only;
graceful degradation so a deploy can precede its migration; no emoji anywhere.
