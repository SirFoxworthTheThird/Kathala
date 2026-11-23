# UX expert run, 2026-11-23, part 1 of 3

Reviewer: the `ux-review` agent, part 1 of 3 (other reviewers covered the rest
of the guide at the same time).

Build: the already-running `vite preview` at `http://localhost:4173` (built with
`VITE_E2E=1` and the Library staged; 58 catalogue entries in
`dist/library/index.json`). I did not build, start or stop anything. Every run
was a fresh Chromium profile (`/opt/pw-browsers/chromium`), driven by scripts in
the scratch directory below. "Laptop" is 1280×800 with a mouse; "phone" is
Playwright's *iPhone 13* (390×664 CSS px, touch, `pointer: coarse` matches);
narrower phones are the same device at 360 and 320; "iPad" is *iPad Pro 11
landscape*. The default theme is dark; "light" is `theme-paper`. Library books
apply their own world theme while open (Jekyll and Hyde is a dark red one).

Scratch directory (scripts `s01.mjs`…`s44.mjs`, screenshots in `shots/`):
`/tmp/claude-0/-home-user-PlotWeave/0059390a-1dc2-55c6-9e96-a775864ab3c7/scratchpad/ux1/`.
Screenshot paths below are relative to that directory's `shots/`.

Contrast was computed from computed colours (alpha and ancestor opacity
composited onto the first opaque background), not judged from screenshots.
The first sweep misread `color(srgb …)` values as 0–255, the trap **W19-10**
describes; it was fixed and the sweep re-run before any number here was kept.

---

## What I covered

Sections: the opening (*What leaves your device*), *Core concept: the time
cursor*, *Getting started — the world selector*, *Set up a blank world*, *The
library*, *Reading alongside a book*, *Reading the book itself*, *What reading
mode puts away*, *Reading mode on your own world*, *Import a manuscript*, *From a
Word draft*, *Generate a world from AI* (without a key), *Start a sequel*, *A
series*, *Join a series*, *The world dashboard*, *Getting around*, *Writing
progress*, *Writing sprints*, *Deadline & projection*, *Manuscript: chapters &
scenes*, *Writing on one page*, *Reading the book*, *Multiple timelines and
timeline relationships*, *Opening a chapter*.

Worlds used: a blank world through the setup guide; *Strange Case of Dr Jekyll
and Mr Hyde* (small, with text) in reading mode and with reading mode off;
*Dracula* (large) with reading mode off; *The Odyssey* (two timelines, frame
narrative) with reading mode off; a two-book series made in the app; imported
`.md` and `.docx` drafts built for the test.

### Coverage ledger

✓ = checked. ◐ = partly checked (what was left out is said). — = does not apply.
✗ = not checked.

| Section | Laptop | Phone (390 / 360 / 320) | Keyboard | Screen-reader snapshot | Dark / light |
|---|---|---|---|---|---|
| Opening, *What leaves your device* | ✓ backup chip | ✓ chip absent below `sm` (by design, see guide G1) | — | ✓ | dark ✓, light ✗ |
| *Core concept: the time cursor* | ✓ | ✓ 390/360/320 pill and controls | ◐ Escape on the clear-cursor confirm only | ✓ | dark ✓, light ◐ (Page screen only) |
| *World selector* | ✓ empty, one world, reading shelf, series | ✓ 390; ◐ 360/320 overflow only | ✓ Tab order, card menu, delete | ✓ | dark ✓, light ✓ (contrast sweep: clean) |
| *Set up a blank world* | ✓ every step, Back, reload mid-guide | ✓ 390, 360, 320 | ◐ fields and buttons; not every step by keys alone | ✓ plus Chromium AX tree | dark ✓, light ✗ |
| *The library* | ✓ tabs, search, cross-tab hand-off, Escape, download | ✓ 390 | ✓ focus on open, Tab, Shift+Tab, close | ✓ plus AX tree | dark ✓, light ✗. Covers not checkable: the art is not staged locally |
| *Reading alongside a book* | ✓ landing, clear-cursor confirm, Read ahead, unreached chapter | ◐ 390 dashboard and Read only | ◐ confirms only | ✓ | world theme only |
| *Reading the book itself* | ✓ Read, readout, Contents, Back to your place, scroll jumps, fling | ✓ 390/360/320 reading area measured | ✗ | ✓ | world theme only |
| *What reading mode puts away* | ◐ dashboard, Book, Cards rows, top bar; map and character screens left to the other parts | ◐ | ✗ | ✓ | — |
| *Reading mode on your own world* | ✓ Settings toggle | ✗ | ✗ | ✓ | dark ✓ |
| *Import a manuscript* | ✓ paste-free `.md` file, preview, import, result inspected in IndexedDB | ✓ 390 | ✗ | ✓ | dark ✓ |
| *From a Word draft* | ✓ a `.docx` with Title, Heading 1/2, italics, bold, table, END | ✓ 390 | ✗ | ✓ | dark ✓ |
| *Generate a world from AI* (no key) | ✓ prompt, bad JSON, fenced JSON preview | ✓ 390 (paste box reachable by scrolling) | ✗ | ✓ | dark ✓ |
| *Start a sequel* | ✓ dialog and the world it makes | ✗ | ✗ | ✓ | dark ✓ |
| *A series* | ✓ make, add a book, dissolve confirm | ✓ 390 dissolve | ✗ | ✓ | dark ✓ |
| *Join a series* | ✓ dialog with a matched person | ✗ | ✗ | ✓ | dark ✓ |
| *The world dashboard* | ✓ blank, series book, Dracula, reading-mode Jekyll | ◐ reading-mode only | ✗ | ✓ | dark ✓, light ✓ (contrast sweep) |
| *Getting around* | ✓ rail hover, focus, pin across reload | ✓ ☰ menu | ✓ menu Tab order and Escape | ✓ | dark ✓ |
| *Writing progress* | ✓ words today, streak, target | ✗ | ✗ | ◐ | dark ✓ |
| *Writing sprints* | ◐ menu opened and measured; no sprint run to its end | ✓ 390 menu measured | ◐ Escape closes the menu | ✓ | dark ✓ |
| *Deadline & projection* | ✓ target 80,000, deadline 2027-06-01 | ✗ | ✗ | ✗ | dark ✓ |
| *Manuscript: chapters & scenes* | ✓ Cards, Add Chapter with a taken number | ◐ Cards not driven on a phone | ✓ via binder | ✓ | dark ✓, light ✓ (Page) |
| *Writing on one page* | ◐ opened, typed, saved; split/join by heading not exercised | ✓ 390 header and Book tools | ✗ | ✓ editor is a named textbox | dark ✓, light ✓ |
| *Reading the book* (writer's Read) | ◐ opened only | ✗ | ✗ | ◐ | ✗ |
| *Multiple timelines* | ✓ tabs, All timelines, New Timeline, Link Timelines (crashes) | ✗ | ✓ tabs | ✓ | dark ✓ |
| *Opening a chapter* | ✓ binder ↓ → Space Enter Escape, chapter panel, ✕ | ✗ | ✓ | ✓ | dark ✓ |

Left for the next pass, honestly: Read aloud on a machine with a voice (this
one has none, so the button was disabled throughout); Page splitting and joining
by headings; the writer's Read; the phone chapter sheet on Page and Read;
light theme on the Library, setup guide and reading screens; *Reading a later
book* (the *Have you read the earlier books?* question) was not reached.

---

## Findings

Ranked by what they cost the person using the app.

### UX-1-1 — high — The dashboard's alive/dead split is end-of-book again: **WRUN-4 is closed, and its symptom reproduces word for word**

- **Screen:** world dashboard, the Characters tile. *The world dashboard* ("the
  cast tile's alive and dead split is as of the moment you are on").
- **What I did:** downloaded *Dracula*, set `readingMode: false`, opened the
  dashboard with the cursor on Ch.1 (*Eastward by Rail*), then cleared the
  cursor to *All chapters*. Laptop, dark. Two runs (`s26.mjs`, `s27.mjs`).
- **Expected:** at chapter one nobody is dead; the count can only rise towards
  the end of the book.
- **What happened:** Ch.1 reads **14 alive, 11 dead**. *All chapters* reads
  **15 alive, 10 dead** — more dead at the first page than at the last. This is
  exactly the measurement **WRUN-4** filed ("*14 alive, 11 dead* at chapter
  one") and closed as fixed.
- **Evidence:** the eleven counted dead at Ch.1 are exactly the characters whose
  record flag `isAlive` is `false`, and none of them has a state at or before
  Ch.1: Count Dracula (first record Ch.2), Lucy Westenra (Ch.5), Quincey Morris
  (Ch.5), Renfield (Ch.5), Mrs Westenra (Ch.6), Mr Swales (Ch.6), the Three
  Vampire Women (Ch.3), the Demeter's captain and mate (Ch.7), Mr Hawkins
  (Ch.14), Petrof Skinsky (Ch.26). Screenshot `25-lap-dash-writer.png`.
- **Mechanism:** `castAliveSplit` (`src/lib/castAtCursor.ts:43-45`):
  `if (aliveById.get(c.id) ?? c.isAlive) alive++`. A character with no state yet
  at the cursor falls back to `character.isAlive`, which is the record's
  end-of-book flag — the very value WRUN-4 said not to read. WRUN-4's fix note
  calls the fallback "the only sensible answer for someone the story has not
  placed", which holds for a new world (where the flag is `true`) and fails for
  every book whose cast dies later: everyone not yet on stage is counted at
  their ending.
- **Why the closure was wrong:** its e2e "walks one world across a death and
  back" — a character who has a state on both sides of the death. The failing
  case is a character with *no* state before the cursor, which that walk never
  makes.
- **Who it costs:** every writer whose characters die, on the one number they
  check after killing someone. Readers are spared, because reading mode drops
  the split. A reader who turns reading mode off is told, at chapter one, who
  dies.

### UX-1-2 — high — On every touch device the shared dialog's ✕ falls out of its corner to the bottom-left of the dialog

- **Screen:** every dialog built on `components/ui/dialog.tsx`. In my sections:
  Create New World, Import a Manuscript, Generate World from AI, Make a series,
  Add a book, Join a series, the delete and dissolve confirms, New timeline, Add
  Chapter, and the reading-mode confirms.
- **What I did:** opened *New World*, *Import Manuscript* and *Generate World
  from AI* on the phone and on the iPad, and read the close button's box and
  computed `position` (`s31.mjs`, `s32.mjs`).
- **Expected:** the ✕ at the top-right, where it is on the laptop.
- **What happened:** with `pointer: coarse` the close button's computed
  `position` is `relative`, not `absolute`. It drops into normal flow after the
  footer, at the bottom-left. Phone: New World ✕ at (25, 485), under the
  Cancel/Create row; Import Manuscript at (25, 567), clipped by the dialog's
  bottom edge; Generate World from AI at (1, 622) inside a 596px scroll box, so
  below the fold. iPad landscape: (350, 548), bottom-left of the dialog. Laptop:
  `absolute`, top-right, as designed.
- **Evidence:** `32-ipad-newworld-dialog.png` (the ✕ sits alone under the
  buttons), `29-ph-im-docx.png` (half a ✕ cut off at the bottom-left),
  `32-ph-ai-dialog-bottom.png`.
- **Mechanism:** `src/index.css:1385` opens
  `@media (hover: none), (pointer: coarse)`, and inside it `.pw-tap { position:
  relative; }` (line 1415). It is unlayered, so it beats Tailwind's `absolute` on
  the same element. Three components put `pw-tap` together with `absolute`, and
  all three are affected: `dialog.tsx:169` (every shared dialog),
  `ImageLightbox.tsx:63` and `HistoryTab.tsx:160`. The 44px `::after` hit area
  still works, but it now hangs off a button in the wrong place.
- **Who it costs:** phone and tablet users, which is everyone using it by touch.
  Most dialogs still have Cancel, but the conventional way out is gone from where
  people look for it, and on the AI dialog it is off-screen.

### UX-1-3 — high — On a phone the sprint menu opens 139px off the left edge of the screen

- **Screen:** Manuscript → Page → **Book tools** → **Sprint**. *Writing sprints*
  ("On a phone, **Sprint** is under **Book tools**").
- **What I did:** opened it on the phone (390, touch) and on the laptop, and read
  the box of the `Start a sprint` group (`s37.mjs`; seen first in `s36.mjs`).
- **Expected:** 15 / 25 / 45 minutes, a minutes box, Start and *Sound at the
  end*, all on screen.
- **What happened:** phone: the panel's box is **x = −139, width 224**. Only
  *45 min* and *Start* show; *15 min*, *25 min*, the *Minutes* field and the
  *Sound at the end* box are off the left edge, and the page does not scroll
  sideways (`scrollWidth` 390), so they cannot be reached. Laptop: x = 129, fine.
- **Evidence:** `36-ph-sprint-menu.png`.
- **Mechanism:** `SprintControl.tsx:111`, `absolute right-0 top-full … w-56`. The
  panel is anchored by its right edge to the Sprint button, and in Book tools
  that button sits at the left of the screen, so the 224px panel grows leftwards
  past 0.
- **Who it costs:** phone writers. Every sprint they start is the default
  length, and the guide's own *Sound at the end* cannot be turned on.

### UX-1-4 — medium-high — **Link Timelines** crashes the whole app on *The Odyssey*

- **Screen:** Manuscript → Cards → **Link Timelines**. *Multiple timelines and
  timeline relationships* uses *The Odyssey* as its example (images 75, 76).
- **What I did:** downloaded *The Odyssey*, turned reading mode off, opened
  Cards, pressed **Link Timelines**. Twice, in fresh profiles (`s40.mjs`,
  `s41.mjs`).
- **Expected:** the Timeline Relationships panel, with the book's frame-narrative
  link.
- **What happened:** the router's fallback page replaces the whole app:
  *"Unexpected Application Error! Cannot read properties of undefined (reading
  'length')"*, with a stack trace and React Router's *"Hey developer 👋"*
  message. The only way out is a reload.
- **Evidence:** `40-link-timelines.png`, `41-run1.png`, `41-run2.png`. The
  stored relationship has `fromTimelineId, toTimelineId, type, label,
  fromEventId, toEventId` and **no `anchors` and no `syncPoints`**. A scan of the
  staged `.pwk` files: six books carry a timeline relationship, and only
  `the-odyssey.pwk` lacks the two arrays.
- **Mechanism:** `TimelineRelationshipPanel.tsx:285`, `rel.anchors.length` (also
  at 288, 305 and 367 for `syncPoints`). The `TimelineRelationship` type declares
  both arrays required, and nothing on import fills them in. No error boundary
  stands between the panel and the route.
- **Who it costs:** a writer who opens the guide's own multi-timeline example to
  learn the feature, and anyone importing a file with a relationship in that
  older shape. Narrow, but it takes down the whole app and shows developer text.

### UX-1-5 — medium — The Library is not a dialog: focus stays behind it, Tab walks the page it covers, and closing drops focus on `<body>`

- **Screen:** world selector → **Library**. *The library*.
- **What I did:** focused **Library**, pressed Enter, then Shift+Tab 14 times;
  read Chromium's own accessibility tree; pressed Escape (`s10.mjs`).
- **Expected:** focus moves into a labelled modal dialog, stays inside it, and
  returns to **Library** when it closes, as with the shared `Dialog`.
- **What happened:** after opening, focus is still on **Library** *behind* the
  overlay. Shift+Tab goes to *Generate World from AI*, *New World* and the page
  body (all covered by the 50% backdrop), and only then wraps into the
  catalogue's Download buttons. Tab forward from the trigger likewise reaches
  *Import World* and *Import Manuscript* under the overlay first. Chromium's AX
  tree has **no node with role `dialog`** and nothing modal; the selector's
  buttons stay in it. After Escape, focus is on the document body, not on
  **Library**.
- **Mechanism:** `LibraryDialog.tsx:340` is a hand-rolled
  `<div className="fixed inset-0 …">`: no `role="dialog"`, no `aria-modal`, no
  `aria-labelledby` (the `<h2>Library</h2>` names nothing), and no
  `useFocusTrap`, although the shared dialog has all four. **LIB-3** gave it
  Escape; this is the rest of the same gap (**X-10** shape).
- **Who it costs:** keyboard users, who start every visit with focus on
  controls they cannot see; screen-reader users, who are not told a dialog
  opened, and can read and press the selector under it.

### UX-1-6 — medium — A new book in a series starts the first-run guide, which asks for "the first character" and makes a duplicate of one the series already has

- **Screen:** world selector → series card → **Add a book**, then the setup
  guide. *A series* ("it opens with the series' cast, places and lore from its
  first page").
- **What I did:** made *Salt Road* with the character *Anna Brisk*, made it a
  series, added book 2, gave its first step a timeline and a scene, then typed
  *Anna Brisk* at step 2, as its wording invites (`s24.mjs`). Laptop, dark.
- **Expected:** a later book either skips the cast step or offers the series'
  cast; at least it should not make a second Anna.
- **What happened:** step 2 reads *"Every story needs someone to follow. Who are
  we watching? Add the first character whose life will change."* — in a book
  whose dashboard already says *1 character*. Accepting makes a second person:
  the Characters screen then lists **two "Anna Brisk"**, one marked *First in
  Salt Road*.
- **Evidence:** `24-book2-wizard2.png`, `24-book2-characters.png`.
- **Mechanism:** the series "Add a book" path creates a world that goes through
  `OnboardingWizard` like a blank one, and `StepCharacter` creates a new
  character rather than looking up the shared cast. *Join a series* does match
  by name; this route to the same place does not.
- **Who it costs:** every writer adding book 2. The duplicate then splits that
  person's scenes and states between two records, which is the problem *Join a
  series* exists to undo.

### UX-1-7 — medium — After a fling through the book, the skip notice names the wrong chapter and its Undo restores the wrong place

- **Screen:** Book → Read, in reading mode. *What reading mode puts away* ("If a
  scroll skips ahead, Kathala says so — *Moved on to chapter 11* — with an
  Undo").
- **What I did:** Jekyll and Hyde at chapter 1; 30 mouse-wheel steps of 3,000px
  at 60ms intervals over the page (a long trackpad fling). Twice (`s44.mjs`).
  For contrast, I set `scrollTop` straight to 55% and then 100% (a scrollbar
  drag, `s18.mjs`).
- **Expected:** a notice naming where my place now is, and an Undo back to
  chapter 1.
- **What happened:** both fling runs end with the place on **Ch.10 · Jekyll Ends
  His Statement** — the last scene, so everything in the book is unlocked — and
  the notice reads **"Moved on to chapter 4"**. Undo puts the place on **Ch.2**,
  not Ch.1. The scrollbar-style jumps behave as the guide says ("Moved on to
  chapter 8", then "Moved on to chapter 10", and Undo returns to 8).
- **Evidence:** `44-fling-run1.png`, `44-fling-run2.png`, `18-jump55.png`.
- **Mechanism:** `ManuscriptBook.tsx:343-372`. Each IntersectionObserver callback
  compares the cursor *before that callback* with the new one, and posts the
  toast only when that single step is two or more chapters
  (`asksBeforeJumping(from, to)`). A fling arrives as 1→2 (no toast), 2→4 (toast,
  Undo target Ch.2), then 4→5…9→10, each a single chapter, so the toast is never
  updated and its Undo target stays at the start of the one large step, not where
  the drift began.
- **Who it costs:** readers. It is the reading-mode promise at its weakest point:
  six chapters revealed while the notice reports two, and the remedy does not put
  them back where they were.

### UX-1-8 — medium — On a phone, Read gives the prose just over half the screen, and none of the chrome gets out of the way

- **Screen:** Book → Read on a phone. *Reading the book itself*.
- **What I did:** measured the prose scroller's box on Jekyll and Hyde at 390,
  360 and 320 (height 664), before and after scrolling 1,500px; then again with a
  local voice stubbed in, so that the *Read aloud* row looks as it would on a
  real phone (`s13.mjs`, `s14.mjs`).
- **Expected:** reading is the screen's whole job, so the page should be most of
  the screen, or the chrome should yield once reading starts.
- **What happened:** with no voice (this machine): prose 250–600, **350px of
  664 (53%)** at 390 and 360, **316px (48%)** at 320. With a voice: prose
  210–600, **390px of 664 (59%)**. Nothing changes after scrolling. Above the
  prose: top bar (48px), the layout row (Binder / Cards / Read / ⋯), the
  progress readout, *Notes for the author* / *Read aloud* / *Contents*, and the
  type row (− 15px + Sans Relaxed). Below it: the chapter bar (64px). A floating
  *In this scene* button sits over the right edge of the text.
- **Evidence:** `12-ph-read.png`, `14-ph-read-voice.png`, `13-320-read-scrolled.png`.
- **Mechanism:** the Read toolbar and readout are static rows above the scroller
  (`ManuscriptBook.tsx`); nothing collapses them while reading. The chapter bar's
  roll-up chevron (guide: *Core concept*) can return about 50px, by hand.
- **Who it costs:** phone readers, about 40% of every page turn. *Was this
  known:* §23 and §25 measured phone widths but not this screen's reading area.
  Labelled **medium** rather than high because the type row and the readout are
  things a reader uses, so the fix is a design call about when to fold them, not
  a defect.

### UX-1-9 — medium — In a Word draft, a scene heading straight under "Chapter One" becomes the chapter's title, and the scene loses its name

- **Screen:** Import a Manuscript with a `.docx`. *From a Word draft* ("Under the
  chapters' level, the next heading down titles a scene").
- **What I did:** imported a `.docx` with *Title* "The Salt Road", Heading 1
  "Chapter One", Heading 2 "The Wreck", prose, Heading 2 "The Shore", prose,
  Heading 1 "Chapter Two", prose. Then read the chapters and scenes it made from
  IndexedDB (`s29.mjs`, `s30.mjs`).
- **Expected:** Ch.1 with scenes *The Wreck* and *The Shore*; Ch.2 with one
  scene.
- **What happened:** Ch.1 is titled **"The Wreck"**, and its scenes are **"Scene
  1"** and "The Shore". Ch.2 has no title. The preview shows "Ch. 1 The Wreck ·
  2 scenes", which looks plausible, and it does not list scene titles, so nothing
  says a scene's name was taken.
- **Evidence:** `29-lap-im-docx.png`; DB dump in `s30.mjs` output.
- **Mechanism:** `docxDraft.ts:362-370`. A heading at the scene level directly
  under a bare chapter heading ("Chapter One") is read as the chapter's subtitle,
  because Kathala's own Word export writes chapters that way. That is a fair rule
  for re-importing Kathala's own export, but in a draft where Heading 2 titles
  scenes it fires on the first scene of every chapter that opens with one, and
  the guide does not mention it. See guide item **G9**.
- **Who it costs:** writers importing a Word draft structured *Chapter* →
  *Scene* headings, which is the structure the guide recommends. Every chapter
  gets its first scene's name, and every first scene becomes *Scene 1*.

### UX-1-10 — low-medium — The world card's ⋯ menu ignores Escape and arrow keys, and does not say it is open

- **Screen:** world selector, a card's **More actions for …** (▾ next to Export).
  *Start a sequel*, *A series*.
- **What I did:** focused the ▾, pressed Enter, ArrowDown, Tab, then Escape
  (`s20.mjs`).
- **Expected:** a menu that opens with focus inside it, moves with the arrows,
  and closes on Escape, as the guide promises for the Manuscript's ⋯ menus.
- **What happened:** focus stays on the ▾ after opening; ArrowDown does nothing;
  Tab reaches *Single file*; **Escape leaves the menu open**. Only a click
  outside closes it. The button has no `aria-expanded`, and the panel has no menu
  or group role.
- **Mechanism:** `WorldCard.tsx:138-215`, a hand-rolled absolute `<div>` of plain
  buttons with a click-outside handler only.
- **Who it costs:** keyboard and screen-reader users. This is the menu the
  sequel, *Make a series* and *Join a series* live in.

### UX-1-11 — low-medium — The phone/narrow navigation drawer says it is modal but leaves focus outside it

- **Screen:** ☰ menu, below `lg` (1024px). *Getting around*.
- **What I did:** opened it on the phone, pressed Tab 22 times, then Escape
  (`s43.mjs`).
- **What happened:** focus stays on *Open navigation menu*; the first two Tabs
  reach *Go to world list* and *Search* in the top bar behind the backdrop;
  Escape closes the drawer and leaves focus on the page body. The drawer is
  `role="dialog" aria-modal="true"` (`TopBar.tsx:56`), so a screen reader is told
  that nothing outside it exists while keyboard focus is outside it.
- **Also:** the drawer's order (Dashboard, Manuscript, Calendar, Structure,
  Characters, Maps…) differs from the rail's (Dashboard, Manuscript, Characters,
  Maps, *More*, Calendar…), so the four "everyday" screens are not together in
  the place the guide puts them.
- **Who it costs:** keyboard users on a narrow window or a tablet with a
  keyboard, and screen-reader users.

### UX-1-12 — low — Buttons repeated on every row do not say which row: *Read to here* / *View from here*, *Export world*, *Delete world*

- **Screens:** Manuscript Cards chapter rows; world selector cards. The guide
  (*Keyboard, screen readers and touch*) says "Buttons that repeat down a list say
  which row they belong to".
- **What happened:** Jekyll and Hyde's Cards in reading mode exposes nine buttons
  named exactly **"Read to here"** (`s16.mjs` strict-mode failure lists them);
  writers get one "View from here" per chapter row. Each world card has **"Export world (single
  file)"** and **"Delete world"** with no world in the name; only the ▾ is named
  for its world.
- **Mechanism:** `ChapterRow.tsx:442-452` puts the row in `title`, not in the
  name; `WorldCard.tsx:129` and `:231` use `title` alone.
- **Who it costs:** screen-reader users navigating by buttons, and voice control
  ("click Delete world" matches every card).

### UX-1-13 — low — The binder tells a screen reader "1 scenes"

- **Screen:** the binder, a closed chapter with one scene. *Opening a chapter*.
- **What happened:** treeitem *"Ch. 1 · Story of the Door 1 scenes"* (reading
  mode, chapter 1 reached at its first scene, `s12.mjs`) and *"Ch. 5 · Incident
  of the Letter 1 scenes"* (`s17.mjs`). The setup guide makes exactly this case:
  one chapter, one scene.
- **Mechanism:** `Binder.tsx:426`,
  `{row.sceneCount}<span className="sr-only"> scenes</span>`. **MS-5** swept these
  into `plural()`; this one is hidden from sight, so it was missed.

### UX-1-14 — low — Day one's projection is seven times too slow: "you'll finish Jan 22, 2112", *behind pace*

- **Screen:** dashboard → Writing Progress, with a target and deadline.
  *Deadline & projection*.
- **What I did:** a new world, 18 words typed today, target 80,000, deadline
  1 June 2027 (`s38.mjs`).
- **What happened:** *"421 words/day to finish by Jun 1, 2027 (190 days left) · at
  ~3/day you'll finish Jan 22, 2112 — behind pace"*. The pace is 18 ÷ 7.
- **Evidence:** `38-lap-writing-progress.png`.
- **Mechanism:** `recentPace` (`src/lib/writingProgress.ts:118-122`) always divides
  by `windowDays = 7`, including days before the world existed or the log began.
- **Who it costs:** a new writer, on the first day they set a deadline. The guide
  calls the forecast "an honest read".

### UX-1-15 — low — The reading-mode dashboard says "Book: 10 chapters · 1 scene"

- **Screen:** dashboard in reading mode, the Book tile. *What reading mode puts
  away* ("they count what you have met so far").
- **What happened:** the chapter count is the whole book (chapter titles are
  never hidden) while the scene pill is the scenes reached, and only this tile
  carries no "so far". On Jekyll and Hyde at its first scene: *10 chapters, 1
  scene*. Screenshot `11-jekyll-dashboard.png`.
- **Mechanism:** `WorldDashboardView.tsx:285-296`, `totalChapters` from the
  ungated chapter list and `totalEvents` from the gated scene list.

### UX-1-16 — low — Timeline tabs: a 12px hover-only trash on each tab, arrow keys inert, two tab stops per tab

- **Screen:** Manuscript timeline tabs. *Multiple timelines*.
- **What happened:** each `role="tab"` wraps two buttons, the name and **"Delete
  ⟨timeline⟩"**, so the tab's name reads *"The Homecoming Present Delete The
  Homecoming Present"* and each tab is two Tab stops. ArrowRight on a tab does
  nothing (the guide's Alt+←/→ reorders; plain arrows, the tablist convention,
  are not handled). The delete is a 12×12px icon at `opacity: 0` until hover; it
  confirms (*"All chapters and scenes in this timeline will be permanently
  deleted"*) without saying how many chapters, or whether Undo can bring them
  back (`s40.mjs`, `40-tab-delete.png`).
- **Why it matters:** the guide's rule is "Inside a book, deleting is always one
  step in … there is no trash icon to catch a stray click". This is the largest
  delete in a book (twenty chapters for *The Homecoming Present*), and it is the
  one that sits in the row.

### UX-1-17 — low — The reading-mode toggle changes its label *and* reports pressed: "Turn off reading mode, toggle button, pressed"

- **Screen:** Settings → Reading mode. *Reading mode on your own world*.
- **What happened:** `aria-pressed="true"` with the name *Turn off reading mode*;
  `aria-pressed="false"` with *Turn on reading mode* (`s25.mjs`). A toggle's
  label should stay the same while its state changes; this one changes both, so
  the pressed state contradicts the words.
- **Mechanism:** `WorldSettingsView.tsx:361-368` (the comment explains the
  choice; the APG toggle-button pattern says the opposite).

### UX-1-18 — low — Contrast: the empty description prompt, and the chapter number on Paper's chapter bar

- *"Describe your world…"*, the control that adds a world description on the
  dashboard: **2.69:1** in the default theme and **2.03:1** in Paper, 14px italic
  (`s28.mjs`). It is button text, not a placeholder attribute, so 4.5:1 applies.
  `WorldDashboardView.tsx:460`, `text-[hsl(var(--muted-foreground)/0.5)]`.
- The chapter number in the chapter bar's track label (*"1 · Chapter 1"*) in
  Paper: **3.8:1 at 8.96px**. (Disabled buttons that also measured under 4.5 are
  exempt and are not counted.)

### UX-1-19 — low — The setup guide sends you to "the Timeline screen", which is no longer called that

- **Screen:** setup guide, step 1 after *← Back a step*: *"Done — your story
  opens on The wreck … Rename any of the three whenever you like, **from the
  Timeline screen**."* (`s04.mjs`). The navigation says *Manuscript* (or *Book*),
  and the guide says the chapter is renamed from the Manuscript's ⋯ menu or its
  panel.

### UX-1-20 — low — Cosmetic layout

- **Setup guide step indicator** wraps with a dangling connector: at 1280 the
  dialog is 576px wide and *4 Done* drops to a second row after a connector that
  leads nowhere; at 390 the two ticks wrap above *3 When we meet them*
  (`02-onboard-1.png`, `04-ph-step3.png`, `04-lap-step4.png`).
- **World selector header divider** stands alone at 1280: the two groups wrap
  onto two rows, but the `sm:block` vertical rule between them is still drawn,
  to the right of the first group (`01-first-lap.png`).
- **World card titles** wrap to three lines (*Strange Case of / Dr Jekyll and Mr
  / Hyde*) because the hover-only actions keep their width while invisible
  (`19-lap-card-menu.png`).
- **Import a Manuscript:** the *World name* field has no space above the
  Cancel / Import row on laptop or phone (`29-lap-im-docx.png`).

---

## The guide out of step

| Id | Guide says | App does | Which is wrong |
|---|---|---|---|
| G1 | *What leaves your device*: "Beside the world's name in the top bar is a small backup chip — *Not backed up* …" | Below `sm` (640px) neither the chip nor the world's name is in the top bar (`FolderSyncIndicator.tsx:113`, a deliberate trade for the time cursor). Between 1024 and 1279 the chip is an icon without words. | The guide, for phones. Its text should say that on a phone the standing is in Settings → Cloud Sync and in the dashboard's one-time suggestion. |
| G2 | *The library*: "Map images and portraits are a separate, much larger download, so they sit behind their own button rather than coming along by default." | One **Download** button per book. The card says *Pictures load from the web* or *Embedded images*, and the size is everything that will come down. | The guide. That paragraph predates the change; the selector section already describes the current behaviour. |
| G3 | *The library*: covers are "**the only pictures in Kathala that are not on your own machine** … currently 26 of the 33 entries". | The opening says library worlds' pictures are linked too ("just under 1,700 images from around sixty different sites"). The catalogue has 58 entries; 2 covers are absolute third-party URLs, and 56 are paths on the library site. | The guide contradicts itself; the paragraph in *The library* is stale. |
| G4 | *Reading the book itself*: "39 of the 46 on the shelf today are complete public-domain novels". | Tabs read *Books you can read 51* and *Structure only 7* (58). | The guide. A count that is restated in prose will keep drifting; "most" would hold. |
| G5 | *What reading mode puts away*, near its end: "The library worlds carry **no text from the books**. They are structural references only." | Fifty-one books carry the whole text, and the card says so ("It includes the complete novel text from Project Gutenberg eBook 11"). | The guide; that paragraph is true only of the *Structure only* tab. |
| G6 | *Getting around*: on a phone "the top bar itself keeps the world name, the time cursor, search, and the Writer's Brief, Continuity, and Help tools". | Phone top bar: ☰, logo, the cursor steppers and pill, undo, redo, search. The world's name, Writer's Brief, Continuity Checker, Recent changes and Help are in the ☰ drawer (§24 recorded this as deliberate). | The guide. |
| G7 | *Start a sequel*: "A wizard lets you choose…" | One dialog, with sections shown only for kinds the world has (a world with no factions, items or maps shows Characters only). | Wording only. |
| G8 | *Generate a world from AI*, step 4: "Click **Import world**". | Matches, but the selector's own button is **Import World**, and `getByRole` matches names case-insensitively: the two collide whenever the dialog is open (found by my own script's strict-mode failure). | Not a guide error; worth knowing for specs. |
| G9 | *From a Word draft*: "Under the chapters' level, the next heading down titles a scene." | Except directly under a bare "Chapter One" heading, where it titles the chapter (**UX-1-9**). | Either. If the rule stays, the guide should say so; better, the preview should list scene titles. |
| G10 | *On a phone*: header buttons are "at least 44 pixels each way". | Measured at 390 with touch: *Binder* 44×44, *Cards* 44×44, **Page 40×44**, **Read 42×44**, *Focus* 44×44, *Book tools* 44×44. | The app, by 2–4px; or the guide's "each way". |
| G11 | *The world selector*: dates as "*Edited 26 Aug 2026*". | "Edited Nov 23, 2026" under an en-US locale. | Neither: the app uses the browser's locale. A note in the guide would stop the next reviewer filing it. |

---

## What I only suspect

- **S-1. The setup guide's step names may not reach NVDA or JAWS.** The step
  names live in `aria-label` on a `<span>` (`OnboardingWizard.tsx:173-175`).
  Chromium's tree does expose them (*"Step 2 of 4: Add a character"*), but ARIA
  prohibits naming a generic element, and several screen readers ignore such
  labels in browse mode. Playwright's snapshot shows the list items as just
  "1", "2", "3", "4". *Would settle it:* NVDA and VoiceOver on the step list.
- **S-2. Read aloud was never enabled here.** This machine has no speech voice,
  so the button was disabled with *"No voice is installed on this device to read
  with."* throughout, and none of *Read aloud* was exercised. *Would settle it:*
  any machine with a local voice.
- **S-3. Library covers.** The cover art is not in the staged `dist/library`
  (e.g. `alice-in-wonderland/art/generated/` is absent), and the two
  third-party covers failed at the proxy, so every card showed without one,
  which is the documented fallback. Lazy loading and the cover layout are
  unchecked.
- **S-4. The same fallback may be on other screens.** UX-1-1's
  `?? c.isAlive` pattern: I checked only the dashboard. The Characters screen and
  map are other reviewers' sections; worth a grep for `isAlive` used as a
  fallback beside a cursor.
- **S-5. The rail does not open for keyboard focus.** Hovering the rail widens
  it 52 → 208px with labels; focusing *Manuscript* with the keyboard leaves it at
  52px, icons only. The links are named for a screen reader, so the cost is to
  sighted keyboard users, and depends on whether the icons alone are enough. Not
  ranked as a finding because I could not establish the cost.
- **S-6. The *Not backed up* chip on a downloaded Library book.** It reads the
  same as on an unsaved novel. A reader may take it as a warning about their own
  work; whether that is worth hiding is a judgement, not a measurement.

---

## What worked

- **Reading-mode gates held everywhere I pushed them.** The ✕ beside the cursor
  asks *"Show the whole book?"* with focus on **Cancel**, and Escape backs out
  with the cursor unchanged. *Read to here* two chapters ahead asks *"Read ahead
  to chapter 5?"*. Opening an unreached chapter by its address shows *"You have
  not reached this chapter yet"* and nothing from it. A scrollbar-style jump of
  several chapters shows *Moved on to chapter N* with a working Undo
  (UX-1-7 is the fling case only).
- **Contents and Back to your place** work as described: going back to chapter
  2 moved the readout to 9% and left the place on chapter 5; **Back to your
  place** returned to 32% and then disappeared.
- **The Library's search** is good: accent-folding (*bronte* → Jane Eyre and
  Wuthering Heights), the hand-off when the current tab is empty (*"Nothing here
  matches 'tolkien', but 2 books do under Structure only"*), and *Show all 58*.
  Download buttons carry their book's name, and the focus ring is clearly
  visible.
- **The setup guide keeps its place** across a reload, and *← Back a step*
  shows what was made rather than offering to make it again. Errors are
  `role="alert"` and say what is missing.
- **The binder's keyboard model** is complete: ↓ moves, → opens with
  `aria-expanded`, Space goes there and moves the cursor, Enter opens a title
  line, Escape throws it away and returns focus to the row.
- **Add Chapter with a taken number** says what will move before anything
  happens: *"Goes in at 3. Chapters 3–10 become 4–11."*
- **Confirms name what they act on:** *Delete "My Draft"?*; *Dissolve the series
  "The Salt Books"?* names both books and says nothing is lost.
- **Import preview of a Word draft** is honest: it lists the lines left out (*END
  · Jane Writer · About 1,000 words*), counts the table it dropped, says bold
  became plain while italics were kept, and takes the world's name from the
  Title style.
- **Generate a world from AI, without a key,** does what it says: the prompt is
  copyable, invalid JSON gets *"That isn't valid JSON. Paste the whole JSON
  response…"*, a fenced answer is stripped and previewed (*Spec World — 1
  character · 1 chapter · 1 scene*), and the paste box is reachable on a phone by
  scrolling.
- **No horizontal page overflow** on any screen I measured at 390, 360 or 320:
  selector, setup guide, Library, dashboard, Read, Page.
- **A blank world's dashboard and its Page, in Paper and in the default theme,** passed the contrast sweep apart from
  UX-1-18, and the world selector passed in both themes.
