# UX fixes, Part 3: the phone

Part 3 of `ux-expert-fixes-plan.md`: what a phone, or a laptop with panels open, made too narrow to use. Each
finding was measured again at the widths the review used (390, 360 and 320 on a phone; 1280 on a laptop) before it
was fixed, and `e2e/phoneLayouts.spec.ts` measures it again after, paired with the wide case it must not break.

| Finding | What it was | Now | Test |
|---|---|---|---|
| UX-1-3 | The sprint menu opened 139px off the left edge of a phone. | Kept on the screen, whichever side its button is on. | the sprint and Export test |
| UX-2-2 | Export's six formats were one row that clipped: PDF past the edge at 390, Word and EPUB too at 320. | Two rows of three on a phone; one row of six from `sm`. | the sprint and Export test |
| UX-3-3 | Knowledge's header went off a phone: *New Fact* at x=325–422 of 390. | Header actions wrap, in `PageHeader` and in the four rosters that pass a row of their own. | the roster test |
| UX-3-2 | Faction members' names were 0px wide, the role and dates taking the row. | The name over its role and dates, each cut short on its own line. | the roster test |
| UX-2-4 | Thread and motif cadence strips were 0px wide on a phone; their warnings were not drawn below 1024px. | The strip takes a line under the name, the warning a line under that. | the thread test |
| UX-2-11 | Cadence strips did not line up from row to row. | From `xl`, every column but the strip is a fixed width, so the strips share columns. | the thread test |
| UX-3-13 | Settings' index wrapped into a sticky block 169px tall, and a jump left the heading under it. | One row on a phone, swiped sideways. A jump's margin is the bar's measured height. | the Settings test |
| UX-1-8 (D-5) | Read on a phone gave the prose 350px of 664 (53%), and nothing got out of the way. | 436px (66%) opened, 552px (83%) reading down. | the Read test |
| UX-2-24 | Changes: the words had about 125px beside the buttons. Goals: the goal a one-line box, the new goal's box 94px. | Changes: the words have the row, the buttons under them. Goals: the box grows to its text; the new box wraps to a line of its own. | the two "cramped" tests |
| UX-3-26 | Targets of 12–14px under a finger: the item's image link, Lore's category rename and delete, Whole words, Map Layers rows. | 44px under a coarse pointer, unchanged under a mouse. | the finger and mouse tests |
| UX-2-13, UX-3-12 | The Revisions *Link* list and Research's *Attach to…* were long lists with no filter. | Both have the filter Lore's *Revealed at* has, and it finds options inside their groups. | the filter test |
| UX-2-19 | Notes beside the Page at 1280 left the prose 364px wide. | Notes, or Research, takes the binder's column while open. | the Notes test |
| G10 | *Page* and *Read* were 40×44 and 42×44 on a phone. | 44 each way. | the sprint and Export test |

Two names from Part 6 came in with the rows they are on: the faction member's chevron is now *{name}’s membership*
with `aria-expanded`, and its ✕ *Remove {name} from the faction* (UX-3-8, in part). The Map Layers chevron is
*{layer}’s maps*, with `aria-expanded`.

## D-5: Read on a phone

The plan's recommendation was to fold the type row and the readout into one **Aa** button, and let the top rows
slide away on a scroll down and come back on a scroll up. That is what was built, and the screenshots went to the
user before merge.

Folding alone saved 6px. The reader's row still ran to three lines: *Notes for the author* on one, *Read aloud* and
its reason for not reading ("No voice is installed on this device to read with.") on the next, then *Contents* and
**Aa**. So on a phone those two buttons show as their icons. Their accessible names are unchanged, since the words
are kept as `sr-only` text, and the reason moved to the button's tooltip, still the button's description for a
screen reader. The row is one line.

| Jekyll and Hyde at 390×664 | Prose |
|---|---|
| Before | 250–600: 350px (53%) |
| After, opened | 164–600: 436px (66%) |
| After, **Aa** open | 222–600: 378px (57%) |
| After, reading down | 48–600: 552px (83%) |

The bottom 64px is the chapter bar, which has its own roll-up. It is not this part's.

**Only the reader's scrolling moves the rows** (`src/lib/scrollChrome.ts`). The first version hid them on any scroll
down. Opening Read restores the reader's place, which is a scroll, so the rows were gone before the reader saw
them. A scroll now counts only within 1.5s of a wheel, touch or key. Any other scroll moves the point the next one
is measured from and nothing else: opening at your place, a jump from *Contents*, Read aloud following along.
1.5s, because momentum scrolling runs on after a flick.

**The rule** (`chromeOnScroll`, pure and unit-tested):
- The rows go once a scroll down has run 24px past the highest point since they were last shown.
- They come back once a scroll up has run 24px past the lowest point since they went. A wobble on the way is not a
  scroll, and a slow scroll up, a few pixels a frame, still counts.
- Within 48px of the top they are always there.
- With the book's tools (⋯) open, nothing hides: they were asked for.

## Code

- **`src/lib/onScreen.ts`:** `onScreenShift` says how far to move a box so it is on the screen with an 8px margin.
  One wider than the screen is pinned left. `useKeepOnScreen` applies it as a `translate` before paint. The sprint
  menu uses it.
- **`src/lib/scrollChrome.ts`:** `chromeOnScroll` and `useChromeHidden`, above. The scroll is heard on the document
  in the capture phase, since the book's scroller mounts when the book has loaded, which can be after the hook runs.
- **`TimelineView`:** on a phone, the timeline tabs and the header row take `hidden` while the rows are away; so does
  the reader's row. `hidden`, not unmounting, so nothing in them loses its state.
- **`ReaderRow` (`ManuscriptBook.tsx`):** on a phone, **Aa** is a disclosure (`aria-expanded`, `aria-controls`) over a
  row holding the readout and the type. It is a row under the button, not a panel over the page, for the reason
  `ReadingTypeControls` gives: a reader setting type is comparing it with the page. The button's name is
  "Aa type and progress", the visible text first.
- **Notes beside the Page:** the store has `pageAside`, set by the Page while Notes or Research is open beside it on
  a wide screen, and not persisted. `TimelineScreen` leaves the binder column out while it is set.
  - The binder's button, pressed then, clears it and opens the binder. The Page hears the store and closes its
    panel.
  - The Page's own changes (a panel closed, the window narrowed) are not that request. A ref marks them, so
    narrowing the window leaves Notes open, over the page, as it was before.
  - The button's `aria-expanded` says whether the binder is shown, not whether it would be.
- **`PageHeader`:** the row wraps, the title takes what is left down to 160px, and the actions wrap.
  - Knowledge, Items, Lore and Factions pass a row of their own as `actions`, and those did not wrap. New Fact was
    still past the edge after the `PageHeader` change. The spec found it. All four rows wrap now.
- **`select.tsx`:** `filterOptions` and `hasOptions` look inside groups. A filtered list keeps a group only if
  something in it matched, and says *Nothing matches* only when nothing in any group did.
- **Smaller ones:**
  - Export's format row is a 3-column grid on a phone.
  - The cadence row wraps below `xl`. From `xl` it has fixed widths for the name, the settle slot and the warning,
    with a hidden placeholder where a row has no warning. A screen reader gets "In k of N chapters".
  - Settings' chips are one scrolling row below `sm`. The jump sets `scrollMarginTop` from the bar's height before
    scrolling.
  - Goals' text is a `Textarea` with `field-sizing: content`; Enter saves. The new goal's box has a 192px basis, so
    it takes a line of its own beside nothing rather than 94px beside everything.
  - Changes' rows wrap; on a phone the words take the row.
  - Touch sizes: `pointer-coarse:` classes, so a mouse sees what it saw before.

## Found on the way

- **Knowledge's header** is in the table: fixing `PageHeader` was not enough, because the four rosters' own action
  rows did not wrap.
- **The rows hid on opening.** Restoring the reader's place is a scroll. Above.
- **The fold alone saved 6px.** Above. The review measured 53% before; folding the type and the readout gave 54%.
  The icons gave 66%.

## Tests

`e2e/phoneLayouts.spec.ts`, 11 tests. Each narrow case is paired with its wide one: Aa absent and the type out at
1280; one row of Export formats at 1280; the strips aligned at 1280; the chips all in view at 1280; Notes not
closed by a narrowed window; Lore's rename under 30px under a mouse.

- **Read on a phone:**
  - One line of reader's buttons with their names.
  - **Aa** folding and unfolding the type and the readout.
  - A scroll by the book itself leaving the rows.
  - A wheel down hiding them, with the prose then over 70% of the screen.
  - A 10px wobble leaving them hidden, and a 60px scroll up bringing them back.
- **Goals:** the text whole and over one line; Enter saving; the new goal's box over 180px.
- **Changes:** the words over 280px on a phone with the buttons under them; Accept and Reject 44px; beside them at
  1280.
- **Notes at 1280:**
  - The binder gone and the prose over 500px.
  - Back on closing Notes.
  - The binder's button closing Notes.
  - A hidden binder staying hidden.
  - A narrowed window keeping Notes.
- **On the screen at 390 and 320:**
  - The sprint menu, all six formats in two rows, and Page and Read at 44.
  - Knowledge's heading, New Fact and its Create, at 390, 360 and 320.
  - Items' Add Item.
  - A faction member's name over 60px, with its role, and a 44px ✕.
  - The cadence strip over 250px, the warning present, the words for a screen reader.
  - The Settings bar under 60px and a jump landing below it, at 390 and in a wrapped bar at 700.
  - The Link and Attach filters, each finding inside its groups and hiding the rest.
- **A finger's width:** the item image link, Lore's rename and delete, Structure's clear and Whole words, all 44.
- **Unit:** `onScreen.test.ts` (4) and `scrollChrome.test.ts` (4), for the two rules.

## Mutants

44 mutants, each gated by `tsc -b`, ESLint and a grep that the mutation landed, run in a separate worktree: 8 against
the unit tests, 36 against `e2e/phoneLayouts.spec.ts`. 43 killed, 1 explained.

**Unit (8, all killed):** `onScreenShift` without its right clamp, its left clamp, or the pin for a box wider than
the screen; `chromeOnScroll` without the threshold going down, going up, without the top zone, with the hidden
anchor not the lowest point, and with the shown anchor not the highest.

- *The hidden anchor* survived the first run. A wobble test passed either way: a slow scroll up, a few pixels a
  frame, is what tells them apart, since an anchor that follows each frame never runs 24px from it. That test is in.
- *No top zone* did not build at first (an unused parameter) and was rewritten to keep it read.

**e2e (36):**

| Area | Mutants | Result |
|---|---|---|
| Read on a phone | rows never hide; the book's own scroll hides them; the header row not hidden; no Aa; the reader's labels drawn | killed |
| Notes at 1280 | the binder stays beside Notes; the binder's button does not close Notes; the Page's own word closes Notes; the aside not said | killed |
| Goals | the box does not grow; Enter makes a new line; the new box has no basis | killed |
| Changes | the words beside the buttons on a phone; Accept small to a finger | killed |
| On the screen | the sprint menu not kept on screen; six formats across a phone; Page and Read small to a finger | killed |
| Headers and rosters | `PageHeader`'s actions do not wrap; its row does not wrap; Knowledge's own row does not wrap; a member's name beside the role; the member's ✕ small | killed |
| Cadence | the strip not on its own line; the warning hidden on a phone; the settle slot not fixed at `xl` | killed |
| Cadence | the name not fixed at `xl` | **explained** |
| Settings | the chips wrap on a phone; no scroll margin; the margin a fixed 64px | killed |
| Filters | groups not searched; no filter on Link; no filter on Attach | killed |
| A finger's width | the item image link, Lore's rename, Structure's clear, Whole words, each small | killed |

- **`PageHeader`'s row not wrapping** survived the first run. The actions wrap on their own, so they stayed on the
  screen, and the test asked only that. What the row's wrap gives is room for the title, so the test now asks that
  Knowledge's title is whole and over 80px wide. Killed on the rerun.
- **The cadence name without its fixed width at `xl`** survives, and is equivalent for what the test checks. With
  it gone the name is `flex-1` with a basis of 0, as the strip is, so the two split what is left the same way on
  every row, whatever the name says, and the strips still line up. The fixed width is kept for what it does give:
  the name a steady column rather than half the row.
- **The fixed 64px margin** needed the second Settings case. On a phone the one-row bar is under 64px, so a guess of
  64 lands below it; at 700px the wrapped bar is taller, and the guess left the heading under it.
- **An earlier run is discarded.** A spec run in the main checkout at the same time started a dev server that the
  mutant run, through `reuseExistingServer`, then used: mutants were tested against unmutated code, and three
  "survived". The run was stopped, the worktree restored, and every e2e mutant run again with nothing else running.

## Checks at the commit shipped

CHECKS-PENDING
