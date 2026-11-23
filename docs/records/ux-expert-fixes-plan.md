# Fixing what the UX expert review found: the plan

**Asked:** plan the fixes for the UX expert review of 23 November 2026 before making any. The review is in three
parts:
- `ux-expert-run-2026-11-23-part1.md`, from the start of the guide to the Manuscript;
- `ux-expert-run-2026-11-23-part2.md`, the book's own tools to the Structure board;
- `ux-expert-run-2026-11-23-part3.md`, from Maps to the end of the guide.

## What there is

- **75 findings** (76 filed; UX-1-2 and UX-2-5 are the same fault): 10 high, 29 medium, 36 low. Every one was
  reproduced by its reviewer and traced to code.
- **I confirmed four of them myself at the shipped commit:**
  - UX-1-3: the sprint menu at x = −139 on a 390px phone.
  - UX-3-3: Knowledge's heading 0px wide, and **New Fact** ending at x = 396, at 390 and 320.
  - UX-2-1: `select.tsx` has a listbox and options but no key handling.
  - UX-1-2: `.pw-tap { position: relative }` at `src/index.css:1415`, inside the coarse-pointer query.
- **27 places where the guide and the app disagree:** G1 to G11 in part 1, 7 in part 2 and 8 in part 3. Some of
  them are the app's fault and close with a finding below. The rest are the guide's.
- **15 suspicions,** each with what would settle it.

**Many findings share a cause.** One CSS rule moves every dialog's ✕ on touch. One component, `Select`, is
behind every dropdown. Five hand-made overlays each lack what the shared `Dialog` already has. A header that
never wraps breaks Knowledge. So the parts are cut by cause where a cause is shared, and by screen otherwise.

## How each part is done

As for #697 to #706:
1. **Re-measured first** at the commit the part starts from. A finding that no longer reproduces is closed as
   such, not fixed.
2. **Tested** under `CLAUDE.md`'s rules: unit tests for pure logic, integration tests against `fake-indexeddb`
   for writes, and Playwright e2e for what needs the browser. Most of these do need the browser: layout at phone
   widths, focus, Escape, touch emulation.
3. **Mutation-tested** in a separate worktree, gated on `tsc && eslint && echo MUTANT-OK && grep`. Every survivor
   is killed or explained.
4. **The guide** corrected in the same PR wherever the part changes what a screen does or looks like, with its
   screenshots refreshed.
5. **A record** per part, `docs/records/ux-fix-<part>.md`.
6. **The full unit and e2e suites** on a production build, at the commit shipped.
7. **A PR into `development`,** merged when you say so.

Then the `ux-review` agent runs again over the screens the part touched, at its tip. A fix is only done when
the reviewer who found the fault can't find it.

## Decisions

These need your call. Each has my recommendation.

- **D-1: who counts as alive before the book has placed them (UX-1-1).** Today a character with no state yet
  is counted by their end-of-book flag, so *Dracula* has 11 dead at chapter 1. WRUN-4 was closed on a test that
  never builds this case.
  - **Recommended:** before a character's first record, count them as their first record says. A character
    first recorded dead (someone dead before the story starts) counts as dead. Anyone else counts as alive. A
    character with no record at all keeps the flag, as a new world needs.
  - **The alternative:** a third figure, *not yet met*. It is more honest but busier, on a tile people glance at.
- **D-2: a Word draft whose first scene heading sits under "Chapter One" (UX-1-9).** The rule that makes it the
  chapter's title is there to read Kathala's own Word export back in.
  - **Recommended:** apply the rule only to a file Kathala wrote, which it can tell from its own file id or
    bookmarks. That needs measuring first: does a plain Word export carry either? If it does not, fall back to
    applying the rule only when the scene heading *repeats* the chapter's title.
  - Either way, the preview lists each chapter's scene titles, so a wrong reading is visible before Import.
- **D-3: a change still waiting when the revision goes back (UX-2-3).**
  - **Recommended:** the tally gives it a figure of its own ("1 stands, 1 turned back, 1 still waiting"). The
    marked file leaves it unsigned rather than signing it *(edit declined)*. The dialog says so beside the
    tally, with a link to *Changes*.
  - First, settle part 2's suspicion: open the marked file and read that change's `w:author`.
- **D-4: how a dropdown works from the keyboard (UX-2-1).**
  - **Recommended:** the WAI-ARIA *select-only combobox* pattern:
    - Enter, Space or Alt+↓ opens the list on the chosen option;
    - ↑, ↓, Home and End move through it, and typing jumps to a match;
    - Enter picks;
    - Escape closes the list and nothing else;
    - Tab picks nothing and moves on;
    - focus returns to the trigger.
  - Filtered lists keep focus in the filter box, and the arrows move the active option.
  - `CLAUDE.md`'s naming rule for triggers stays as it is.
- **D-5: Read on a phone (UX-1-8).** The prose gets 48–59% of the screen.
  - **Recommended:** fold the type row and the readout into one **Aa** button, and let the top rows slide away
    while the reader scrolls down and come back on a scroll up, as reading apps do.
  - This changes how Read looks on a phone, so it gets a screenshot and your look before merge.
- **D-6: the reading-mode toggle's name (UX-1-17).** It changes its words and also reports *pressed*.
  - **Recommended:** a fixed name, *Reading mode*, with the pressed state saying whether it is on. The code
    comment that chose otherwise is answered in the record.
- **D-7: a new book in a series and the setup guide (UX-1-6).**
  - **Recommended:** a book added to a series skips the setup guide's character step and says *"Your series'
    cast is here — 1 character"*. A name typed later anywhere goes through the same name match *Join a series*
    uses.
- **D-8: deleting, in one voice (UX-3-22, UX-1-16).**
  - **Recommended rule:** a confirm says *"Undo brings it back"* wherever Undo does, and *"This cannot be
    undone"* only where that is true.
  - Delete sits at the panel's foot in the quiet weight the map panels already use.
  - A timeline's delete, the largest in a book, moves off its tab into the tab's ⋯ menu, and its confirm gives
    the number of chapters.
- **D-9: the map's Alive badge (UX-3-21).**
  - **Recommended:** keep it one click, since Undo already works, but make it look and read like a control:
    *"Alive — mark as dead"* with `aria-pressed`, and a toast with Undo, as other state edits have.
- **D-10: motif warnings (UX-2-18).** Six of seven *Dracula* motifs are amber.
  - **Recommended:** the same rule as threads: at least five quiet chapters and a third of the motif's span.
  - A design call, so it comes with before-and-after counts on the Library.
- **D-11: the Arc grid's *Clear filter* (UX-3-17).** It clears the global time cursor, not the filter.
  - **Recommended:** show it only when the filter box has text, make it clear the box, and leave the cursor to
    the top bar.

## Parts

In order of cost to the person using the app. Shared causes come first, because one fix there closes findings
on many screens.

### Part 0: settle the suspicions that change a fix

These come before any code, because each one changes a fix below.

- **UX-2-3:** does the marked file sign a waiting change *(edit declined)*? (D-3)
- **UX-2-6:** which other dialogs with a nested confirm close both on one Escape? List them with
  `grep -l ConfirmDialog` among files that pass an inline `onOpenChange`.
- **UX-2-7:** is a reply lost when you press **Edit** too?
- **UX-2-5 / UX-1-2:** does `HistoryTab.tsx:160`'s ✕ drop as well on touch?
- **UX-1-1, part 1's S-4:** does the end-of-book `isAlive` fallback appear on other screens beside a cursor?
  Grep for it.
- **D-2:** what Kathala's own Word export carries that a draft does not.

### Part 1: the shared controls

**Findings:** UX-2-1, UX-1-2/UX-2-5, UX-2-16/UX-3-15, UX-2-6, UX-2-9, UX-2-15.

- **`Select`:** keyboard operation per D-4. This is the largest single fix, because every dropdown uses it. It
  also gets a minimum list width for unfiltered lists (UX-2-13's one-word lines).
- **`.pw-tap`:** gives the `::after` a positioned parent without overriding a positioned button, for example
  `.pw-tap:not(.absolute):not(.fixed)`. It also comes off the portrait's ⋯ button, where its hit area covers the
  portrait. The class's own comment warns against exactly that.
- **The dialog ✕:** a `focus-visible` ring.
- **Stacked dialogs:** `Dialog` keeps its layer when its parent re-renders, so Escape closes only the top one
  whatever `onOpenChange` the caller passes. The existing spec gains a parent with an inline handler, which is
  the case that fails.
- **Find & replace and Scene history:** named by a `DialogTitle`; each scene's *Replace* says which scene; and
  the result is announced.

### Part 2: overlays that should be dialogs, and Escape

**Findings:** UX-1-5, UX-2-12, UX-3-14, UX-1-11, UX-1-10, UX-3-7 (and the menu half of UX-3-5).

- **Overlays:** the Library, Focus mode, Help and the narrow navigation drawer each get what the shared dialog
  has: a role, a name, a focus trap, focus moved in on opening, and back to the opener on closing.
  - For Help this means deciding between a dialog and a complementary landmark. **Recommended:** dialog, as the
    Brief is.
- **Menus:** the world card's ⋯ and the map's ⋯ Map tools become menus: `aria-expanded`, arrow keys, and
  Escape.
- **Escape on panels:** the map's location, route, region and character panels, the faction panel, the item's
  inline edit, and the search palette with focus anywhere inside it. That makes the Help panel's own line, *Esc
  closes panels*, true.

### Part 3: the phone

**Findings:** UX-1-3, UX-2-2, UX-3-3, UX-3-2, UX-2-4, UX-2-11, UX-3-13, UX-1-8 (D-5), UX-2-24, UX-3-26, UX-2-13,
UX-3-12, UX-2-19, and G10.

- **The sprint menu:** placed within the screen whichever side its button is on, and so is any popover that
  shares the pattern.
- **Export's formats:** wrap onto two rows rather than clip.
- **`PageHeader`:** its actions wrap below the title on a phone, or fold to icons as Lore's do. That fixes
  Knowledge and any other roster with three actions. Verified at 390, 360 and 320.
- **Faction members:** the name truncates last; the role and dates wrap under it.
- **Cadence strips:**
  - every row's strip takes the same columns, so a chapter lines up down the widget;
  - the warning shows as a line under the row below `lg`, rather than not at all;
  - the cadence is given to a screen reader as text.
- **Settings:** the index folds to one row on a phone. Its scroll margin is the bar's measured height, not a
  guess.
- **Read on a phone:** per D-5.
- **The cramped ones:** the Changes rows, the Goals fields, the Structure ✕, the 12–14px targets part 3 lists,
  and Page and Read to 44px.
- **Long pickers:** the Revisions *Link* list and Research's *Attach to…* get the filter box that Lore's
  *Revealed at* already has.
- **Notes beside the Page at 1280:** the panel takes the binder's place rather than squeezing the prose to
  364px.

### Part 4: crashes, traps and one-click losses

**Findings:** UX-1-4, UX-3-1, UX-3-4, UX-3-5, UX-3-21 (D-9), UX-3-18, UX-1-16 (D-8), UX-2-7, UX-2-8, UX-3-25.

- **Crashes:**
  - a route-level error boundary: a plain message, *Reload*, and *Copy the details*, never React Router's
    developer page;
  - a timeline relationship without `anchors` or `syncPoints` is mended on import and on reading;
  - the six staged books are checked for the same shape.
- **Maps with a missing picture:** keep the sidebar and the canvas, and put the empty state where the picture
  goes, as F-7 did for an unreachable picture. A root map without a picture is not called a sub-map.
- **Help over the map:** Help's layer goes above the map's controls, as the Brief's and Recent changes' already
  do.
- **Clear scale:**
  - goes through the journal, so Undo brings it back;
  - is a labelled control inside the menu, not a 12px ✕ that looks like the menu's close;
  - a toast says what happened.
- **Deleting a map:** by keyboard, and by touch on purpose. The trash shows on focus, and on touch it is always
  drawn.
- **Losing words:**
  - a reply typed under a note is saved with Resolve, or Resolve asks first;
  - **Edit** does the same, if Part 0 finds it loses the reply too.
- **Find & replace's *Also rename*:** unticked, with a reason, when the new name is already a character's.
- **Broken pictures:** a portrait that fails to load falls back to the initials it already has, and a failed
  map picture shows no broken-image glyph.

### Part 5: wrong answers

**Findings:** UX-1-1 (D-1), UX-2-3 (D-3), UX-2-14 with UX-2-29, UX-3-11, UX-3-16, UX-1-14, UX-1-15, UX-1-7,
UX-1-9 (D-2), UX-1-6 (D-7), UX-2-17, UX-2-22, UX-2-23, UX-2-18 (D-10), UX-3-17 (D-11), UX-3-19.

- **The alive and dead count:** per D-1. WRUN-4's spec gains the case it never built: a character with no state
  yet.
- **The revision tally:** per D-3.
- **A WebP cover:** turned into a JPEG for the export, which the browser can already do, rather than refused.
  The box stays ticked because it will work.
- **Whereabouts of a collective item:** lists every holder, as the roster does.
- **Recent changes and the Undo label:** name the fields that differ, not every field the form wrote. A pure
  function compares the record before and after inside `withJournal`.
- **The projection:**
  - the pace divides by the days the log has existed, up to seven, not always by seven;
  - the reading-mode Book tile counts chapters reached *so far*, as its scenes do.
- **A fling in Read:**
  - consecutive moves within a short burst are one move;
  - the notice names where the place ended up;
  - Undo goes back to where the burst began.
- **Word drafts:** per D-2. **A new book in a series:** per D-7.
- **Smaller wrong answers:**
  - *Goes quiet* names the quiet chapters, not the thread's span;
  - an unplaced Plot Point 2 is said as such, rather than drawn as a one-chapter Act 2;
  - Changes are listed in reading order;
  - motifs, per D-10;
  - the Arc's *Clear filter*, per D-11.
- **The relationship graph:**
  - fits below its own toolbar;
  - re-fits on **Focus on one character**;
  - does not say *zoom in to read the labels* when no edges are drawn.

### Part 6: names, contrast and consistency

**Findings:** UX-1-12, UX-1-13, UX-1-17 (D-6), UX-2-20, UX-2-21, UX-2-25, UX-2-28, UX-3-8, UX-3-9, UX-3-10,
UX-3-20, UX-1-18, UX-2-10, UX-2-26, UX-3-6, UX-2-27, UX-3-22 (D-8), UX-3-23, UX-3-24, UX-1-19, UX-1-20, UX-3-27.

- **Names:**
  - repeated buttons say their row;
  - "1 scenes" becomes "1 scene";
  - map markers, chevrons and faction buttons are named;
  - graph edges and nodes are named by character names, not ids;
  - the graph's 40 dead Tab stops are taken out (`nodesFocusable` and `edgesFocusable` off, as X-7a decided);
  - the Arc grid gets row headers and a heading;
  - triggers carry both their field and their value, as `CLAUDE.md` asks: the source rule in
    `labelAssociation.test.ts` gains the static-`aria-label` case;
  - revision tasks are named once, not four times;
  - a diff marks insertions with `ins` and `del`;
  - the reactions map says *none*, not *dot*;
  - *Send to the author* says what it did.
- **Contrast,** measured, not judged:
  - Paper's amber warnings become a theme token;
  - the description prompt;
  - the tab counts;
  - the chapter-bar number;
  - the relationship canvas follows the theme.
- **Consistency:**
  - one date format;
  - deleting per D-8;
  - the empty Maps screen offers each door once, under one name;
  - Audit with AI says why its buttons are off;
  - the setup guide stops sending writers to "the Timeline screen";
  - the cosmetic items in UX-1-20 and UX-3-27.

### Part 7: the guide

- **What remains after the app fixes,** from the three *guide out of step* lists, part by part:
  - **Part 1's list:** G1 (the phone's top bar and backup chip), G2 and G3 (the Library's stale images
    paragraph), G4 and G5 (stale counts, and "no text from the books"), G6, G7 and G11.
  - **Part 2's list:**
    - Cast Balance and Structure as wide-screen views;
    - where *History* is on the Page;
    - Export's three undocumented options.
  - **Part 3's list:**
    - the breadcrumb below 1280;
    - Settings' fourteen chips under their own names;
    - *rebuilt*;
    - a relationship starts at the cursor;
    - the Family tree's caption, and *Wuthering Heights*, which has no family recorded. **Recommended:** record
      the family in the Library book, since the guide's example should work, and if not, re-caption it.
- **Kept as a design note only:** part 2's item 7, the writer's Read with three rows of buttons, joins D-5's
  look at Read rather than being re-filed.
- **The guide's own counts:** "most" rather than a number that drifts.
- Each part above fixes the guide for its own screens. This part is what is left over.

## Order, size and tracking

- **Parts 1 and 2 come first:** they are shared causes, and most findings close there or depend on them.
- **Parts 3 to 5 can then go in any order.** I would take 4 before 5, since losing work costs more than a wrong
  figure.
- **Part 6** comes after the screens are settled, so names are not given twice.
- **Part 7** comes last.
- **Seven PRs,** each a size of #703 to #706.
- **Each record** carries a table of its findings: *fixed* (with its test), *closed on re-measure*, or *moved to
  part N*. Nothing is dropped silently.

## Not in this plan

- **The coverage the review did not reach:**
  - Read aloud with a voice;
  - real folder sync;
  - the calendar editor;
  - map playback, floors and routes;
  - research uploads;
  - successions;
  - most of the Paper theme;
  - many phone and keyboard columns.
- **That gap comes back as its own `ux-review` run** once Parts 1 and 2 have landed, so it reviews the shared
  controls as fixed rather than re-finding them on every screen.
