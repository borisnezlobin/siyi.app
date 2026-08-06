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
