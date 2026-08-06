# Siyi backlog

Working file. Delete entries as they ship. Ordered by launch risk.

## Done (shipped and live)

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

- [ ] **Marketing email consent + unsubscribe.** `marketing_opt_in` column
      (default false), settings toggle, `/api/unsubscribe` with a signed
      token, List-Unsubscribe header. Postal address for the footer:
      110 Sproul Hall, Berkeley, CA 94720, care of Boris Nezlobin.
- [ ] **Push notifications failing for real users.** Root cause still
      unconfirmed; new error messages ship the diagnosis. Collect one real
      failure message before guessing further.
- [ ] **Discard-changes confirmation** when leaving an edited profile.
- [ ] **Edit an update after saving it** (currently write-once).
- [ ] **Editable "first met" date** on the person form.
- [ ] **Editable date on an update** (defaults to now, no way to backdate).

## P1 — UX that users tripped on

- [ ] **Updates page layout.** Move "Add update" into the Updates card
      header; move "Next reminder" into the right column above Quick facts;
      make the duplicate message icon a plus, or remove it.
- [ ] **Person picker does not scale.** A plain dropdown breaks past ~100
      contacts. Needs a search/typeahead.
- [ ] **Turning reminders off.** No opt-out today. See relationship rework.
- [ ] **Relationship rework.** Replace the 1-4 strength numbers with
      something human. Consider: named tiers, a custom label per person, or
      dropping the concept and letting people opt into reminders per person.
      Reminders should probably be opt-out at the person level.
- [ ] **Custom "Other" update type** with a user-supplied label and emoji.

## P2 — features requested

- [ ] **Admin at /admin** for Boris and Jerry only. Anonymised: user count,
      contacts-per-user distribution, retention. Plus targeted announcements
      and push to segments ("all users", "users with 100+ contacts").
- [ ] **Multiple emails / phones / Instagram handles per person.** Schema
      change: child tables or JSONB. Touches import/export, vCard, contact
      sync, and search.
- [ ] **Richer notes.** Markdown or a small rich-text control, or custom
      fields per person. See the note in the recommendations below.
- [ ] **Map of hometowns / locations.** Needs geocoding. Possible paid tier.
- [ ] **Cleaner person URLs** — `/people/boris-nezlobin` instead of a uuid.
      Slug plus short suffix on collision, with the uuid still resolving.

## Ops / not code

- [ ] Re-paste the five email templates into Supabase (they changed to
      token_hash).
- [ ] Raise the OTP expiry in Supabase Auth.
- [ ] Make `www.siyi.app` canonical; point the Vault cron URL at it.
- [ ] Enable Apple and Google providers.
- [ ] Set `APPLE_TEAM_ID` so universal links resolve.
- [ ] Resend: verify a sending subdomain for marketing mail.
- [ ] iOS build needs an Apple Developer account (18+). Blocked.
