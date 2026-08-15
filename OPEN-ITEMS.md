# Open items

Raised 2026-08-07 after seeing the app on a real phone. Delete lines as they
ship. Nothing here is speculative — every line is something the owner asked
for directly.

Audited 2026-08-15 against the working tree rather than against memory. Most of
what was still unticked here had in fact shipped and nobody had come back to
the file; those lines now carry what the answer turned out to be. Anything left
unticked was checked and is genuinely still open.

## Your Card screen (web + phone)

- [x] The public-page switch moves to the **top** of the screen and reads
      **"Enable shareable link"**. On by default.
      CAREFUL: default-on applies to NEW profiles only. Never flip an existing
      row from off to on — that publishes someone's details without them doing
      anything.
- [x] Default shared fields: **full name and major only**.
- [x] **QR code and copy link move to the top** of the screen.
- [x] When the switch is off, **everything below it disappears**. Greying it out
      was the first answer and has been superseded: a disabled control still
      invites you to try it.
- [x] Choosing what goes on the card is **its own page**, reached from Your
      card. The card's own details are editable there — on the web they never
      were at all.
- [x] "People can find you as" → **"People can find you at <link>"**. Nothing in
      the app offers a name#number, so "as" describes something that does not
      exist.
- [x] Delete the explanatory line under the switch. "The name stays yours" says
      nothing if the page does not exist.
- [x] **Default university does not belong on this screen.** Move it somewhere
      that makes sense for a new-person default, on both platforms.
- [x] **No back button** on the Your Card screen on the phone.

## Share sheet

- [x] It is an `AppBottomSheet` now, so it swipes closed and the backdrop
      behaves like every other sheet in the app. The share and card actions sit
      in the sheet's `footer` rather than in the scrolling content, which is
      also what keeps them above the keyboard.
- [x] **`Share` icon, not `ShareNetwork`.** `ShareNetwork` appears nowhere in
      the repo any more. The person screen's header button and the sheet's
      first action both use the plain `Share` glyph.

## Headings and typography

- [x] Settings was the only screen with its own title style — grey, 11px, wide
      tracking. It uses the shared heading now. The web's settings sections had
      also regrown icons in tinted circles, which pushed those headings out of
      line with the ones that had none. Swept the rest of the web too: the only
      circles left are avatars, the logo mark and the floating add button.

## Person detail

- [x] The section header icons are unreadable. Every section action goes
      through one `SectionAction` in `surface.tsx` now, which draws a small icon
      beside the words for what it does — "Add reminder", "See all", "Log
      interaction", "Add update". Nothing is left to guess from a glyph.
- [x] Reminders and History use different icon setups in the same screen. Both
      are built from that same `SectionAction`, on the phone and on the web, so
      there is one pattern rather than two.

## Web and phone still do not match

- [x] People list: both platforms take the avatar colour from a shared
      `avatar-colors.ts`, byte-identical in `src/lib` and `apps/mobile/src/lib`,
      so a person is the same colour in both. The extra icon button is gone from
      the web row, which now carries the same avatar, name, last-seen line, note
      and chevron the phone row does.
- [x] Relative dates differ. All of the wording lives in `relative-time.ts`,
      again identical in both apps, and it counts calendar days rather than
      elapsed hours — so something written at 11:58pm reads as "Yesterday" two
      minutes later on both platforms, not "23 minutes ago" on one of them.

## Keyboard — the long-running one

- [ ] Inputs and the primary action must stay visible with the keyboard up,
      everywhere: every screen, sheet, modal and inline editor on the phone,
      and any web dialog with the same problem. Three previous attempts tweaked
      props and did not hold.
      The mechanism has to be structural rather than trusting the sheet library
      to lift far enough: the primary action pinned in a footer outside the
      scrollable region, and the focused field scrolled into view on focus.
      IN FLIGHT.

- [x] The add button in the tab bar sat at `top: -35` inside the bar, so its
      raised half hung outside its parent. iOS does not deliver touches to a
      subview outside its parent's bounds, so that half was dead and the tap
      fell through to the button behind it. The shell is taller by the overhang
      now and the button sits inside it.

## Reminders

- [x] "Due in X days" must also show the actual date. `dueDateLabel` appends it
      whenever the phrase does not already name the day, so "Due in 5 days ·
      Mar 16" and "4 days overdue · Mar 7", while today and tomorrow stay as
      they were. The year is only printed when it is not the current one.
