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

- [x] It is a plain `Modal`, not a bottom sheet. `share-person-sheet.tsx` uses
      `AppBottomSheet` with a real `footer` now.
- [x] **`Share` icon, not `ShareNetwork`.** No `ShareNetwork` left anywhere in
      the phone app.

## Headings and typography

- [x] Settings was the only screen with its own title style — grey, 11px, wide
      tracking. It uses the shared heading now. The web's settings sections had
      also regrown icons in tinted circles, which pushed those headings out of
      line with the ones that had none. Swept the rest of the web too: the only
      circles left are avatars, the logo mark and the floating add button.

## Person detail

- [x] The section header icons are unreadable. Every section action is a
      labelled `SectionAction` now — no clock or arrow-out-of-box to decode.
- [x] Reminders and History use different icon setups in the same screen. Both
      go through the one `SectionAction`.

## Web and phone still do not match

- [x] People list: avatars are multi-coloured on web and all green on the
      phone; web rows carry an extra icon button the phone does not have.
      `avatar-colors.ts` is identical on both and neither row has the button.
      The phone's `Avatar` now defaults to 48 to match the web's `md`.
- [x] Relative dates differ: web says "1 day ago" / "23 minutes ago" where the
      phone says "Yesterday" / "Today". `relative-time.ts` is identical on both
      and both rows call `lastSeenLabel`.

## Keyboard — the long-running one

- [ ] Inputs and the primary action must stay visible with the keyboard up,
      everywhere: every screen, sheet, modal and inline editor on the phone,
      and any web dialog with the same problem. Three previous attempts tweaked
      props and did not hold.
      The mechanism has to be structural rather than trusting the sheet library
      to lift far enough: the primary action pinned in a footer outside the
      scrollable region, and the focused field scrolled into view on focus.
      Both known holes are closed:
      - `timezone-picker.tsx` was a hand-rolled `Modal` with a bare
        `TextInput`. It is an `AppBottomSheet` with a `BottomSheetFlatList` and
        a `BottomSheetTextInput` now, so the sheet lifts for the keyboard
        instead of the keyboard covering the search box. NEEDS A LOOK ON THE
        DEVICE — it ships in onboarding, and nobody has seen it run.
      - `contact-method-field.tsx` could not be told it was in a sheet at all.
        It takes and forwards `bottomSheet` now, so the trap is gone even
        though its only caller is still a full screen.

- [x] The add button in the tab bar sat at `top: -35` inside the bar, so its
      raised half hung outside its parent. iOS does not deliver touches to a
      subview outside its parent's bounds, so that half was dead and the tap
      fell through to the button behind it. The shell is taller by the overhang
      now and the button sits inside it.

## Reminders

- [x] "Due in X days" must also show the actual date. `dueDateLabel` reads
      "Due in 5 days · Aug 22" everywhere, and the people-row overdue chip goes
      through the same helper rather than its own wording —
      `formatOverdueDuration` is deleted from both platforms, so there is one
      sentence for one idea.
