# Open items

Raised 2026-08-07 after seeing the app on a real phone. Delete lines as they
ship. Nothing here is speculative — every line is something the owner asked
for directly.

## Your Card screen (web + phone)

- [x] The public-page switch moves to the **top** of the screen and reads
      **"Enable shareable link"**. On by default.
      CAREFUL: default-on applies to NEW profiles only. Never flip an existing
      row from off to on — that publishes someone's details without them doing
      anything.
- [x] Default shared fields: **full name and major only**.
- [x] **QR code and copy link move to the top** of the screen.
- [x] When the switch is off, **everything below it greys out**.
- [x] "People can find you as" → **"People can find you at <link>"**. Nothing in
      the app offers a name#number, so "as" describes something that does not
      exist.
- [x] Delete the explanatory line under the switch. "The name stays yours" says
      nothing if the page does not exist.
- [x] **Default university does not belong on this screen.** Move it somewhere
      that makes sense for a new-person default, on both platforms.
- [x] **No back button** on the Your Card screen on the phone.

## Share sheet

- [ ] It is a plain `Modal`, not a bottom sheet: cannot be swiped closed, and
      the shadow animates in with the sheet, which no real app does.
      `@gorhom/bottom-sheet` is already a dependency and already used by the
      capture sheet — use it.
- [ ] **`Share` icon, not `ShareNetwork`.** Asked for previously and missed.
      Three places: `apps/mobile/src/app/(app)/people/[id].tsx` (x2) and
      `apps/mobile/src/components/share-person-sheet.tsx`.

## Headings and typography

- [ ] Headings are not one style across the app. Settings headings are light
      grey with odd letter spacing; People and other pages differ again. One
      scale, one weight, one colour, applied everywhere on both platforms.

## Person detail

- [ ] The section header icons are unreadable. A duotone clock meaning "add an
      update" and an arrow-out-of-box meaning "open reminders" are both guesses
      the user should not have to make. Label the actions.
- [ ] Reminders and History use different icon setups in the same screen. One
      pattern for both.

## Web and phone still do not match

- [ ] People list: avatars are multi-coloured on web and all green on the
      phone; web rows carry an extra icon button the phone does not have.
- [ ] Relative dates differ: web says "1 day ago" / "23 minutes ago" where the
      phone says "Yesterday" / "Today". One helper, both platforms.

## Reminders

- [ ] "Due in X days" must also show the actual date.
