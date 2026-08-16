# Open items

Raised 2026-08-07 after seeing the app on a real phone. Delete lines as they
ship. Nothing here is speculative — every line is something the owner asked
for directly.

Checked against the code on 2026-08-15. Most of what was still unticked had in
fact shipped; those lines are gone rather than left to be re-read. What is
below is what the code does not do yet.

## Keyboard — the long-running one

- [ ] Inputs and the primary action must stay visible with the keyboard up,
      everywhere: every screen, sheet, modal and inline editor on the phone,
      and any web dialog with the same problem. Three previous attempts tweaked
      props and did not hold.
      The mechanism has to be structural rather than trusting the sheet library
      to lift far enough: the primary action pinned in a footer outside the
      scrollable region, and the focused field scrolled into view on focus.
      IN FLIGHT. `AppBottomSheet` has its `footer`, `FormField … bottomSheet`
      registers with the sheet, and `Screen` takes a `footer` now — which is
      what check-in was already passing to a prop that did not exist, so its
      save button rendered nowhere at all. The rest is the sweep: every other
      screen with a primary action still keeps it inside the scroll view.

## Shipped since this file was written

Kept as a record of what was checked, not as work.

- Your Card screen, both platforms: every line ticked.
- Share sheet: it is an `AppBottomSheet` on `@gorhom/bottom-sheet`, and all
  three sites use the `Share` icon rather than `ShareNetwork`.
- Person detail: every section action carries a label, and Reminders and
  History use one pattern.
- Web and phone match: `avatar-colors.ts` and `relative-time.ts` are
  byte-identical in `src/lib` and `apps/mobile/src/lib`.
- Reminders: `dueLabelForDaysAway` renders the day it lands on beside the
  count, from the one helper both apps use.
- The tab bar's add button sits inside its parent's bounds.
