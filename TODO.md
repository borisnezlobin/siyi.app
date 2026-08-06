# Siyi backlog

> **HOLD: one commit is committed locally but deliberately NOT pushed.**
> `11a954b` (relationship labels + reminder opt-out) writes to
> `people.relationship_label` and `people.reminders_enabled`. Those columns do
> not exist until `0008_relationship_labels.sql` runs. Pushing first would make
> every profile save fail and stop the reminder cron.
>
> Order: run 0008 in Supabase, then `git push origin main`.

Working file. Delete entries as they ship. Ordered by launch risk.

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

- [ ] **Push notifications failing for real users.** Root cause still
      unconfirmed; new error messages ship the diagnosis. Collect one real
      failure message before guessing further.
- [ ] **Edit an update after saving it** (currently write-once).

## P1 — UX that users tripped on

- [ ] **Person picker does not scale.** A plain dropdown breaks past ~100
      contacts. Needs a search/typeahead.
- [ ] **Custom "Other" update type** with a user-supplied label and emoji.

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

- `0007_marketing_consent.sql` — NOT YET APPLIED. The settings toggle errors
  until it is.
- `0008_relationship_labels.sql` — NOT YET APPLIED. Adds relationship_label
  and reminders_enabled, and replaces the create-person RPC.
