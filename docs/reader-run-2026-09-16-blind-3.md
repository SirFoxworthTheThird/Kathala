# Reader run — 16 September 2026 (blind, third)

Branch `claude/professional-tool-positioning-ew5ohh`, level with `development`.
Production build (`VITE_E2E=1 npm run build`, so the 44-book catalogue is served
from `dist/library` rather than the public site), driven in Chromium through a
persistent profile so that closing the browser and coming back is a real test.

**Environment caveat, stated once so it never becomes a finding.** This sandbox
has no route to `upload.wikimedia.org`, where the library's map backdrops are
hot-linked from. Every "This map's picture could not be loaded" state in this
run is my network, not the app. Character and item portraits *did* load for
Dracula, because I staged `library/dracula/art` locally.

---

## Correction, added 16 September 2026 after review

**A-1, A-2 and A-4 were rejected. The report's headline and its "A-1 first"
recommendation do not stand, and the verdict that rests on them does not either.**

All three say the app should hide chapter titles from a reader. It should not. A
chapter title is printed on the contents page of the reader's own book, which is
the premise `SearchPalette.tsx` already states, and hiding it would give a reader
*less* than the paperback beside them. Checking the shipped data settles it:
*Alice* has Carroll's own titles, *Dracula* has Stoker's document headings,
*The Moonstone* has Collins's structural divisions, *Pride and Prejudice* has
numbers. For all four, gating the title takes something away and returns nothing.

What the run actually found is **B-1, and only B-1**: *The Woman in White*'s
titles are invented, and they are written as summaries. Collins numbered his
chapters. The report reasoned correctly from the one book it read and then
generalised a property of that book onto the application.

That is a violation of **EX-008**, which already required a supplied chapter
title to be declared in Lore, and of the new **EX-009**, which now requires such
a title to name its chapter rather than summarise it. Both live in
PlotWeave-Library. The rules added in response to this run are in that
repository's `docs/AUTHORING.md`; the enforcement gap — `libraryChapterTitles`'
hand-kept list, which has *The Woman in White* nowhere on it — is recorded there
too.

Everything else in this report stands, including the whole of **What worked**,
and A-5 through A-10 are unaffected.

---

## What I set out to read

**The Woman in White**, Wilkie Collins. I picked it deliberately: 62 chapters,
eighteen named people, and a story told in relays by seven different narrators
through diaries, letters and depositions. It is the book where "was that the
woman at the inn, or the one in the letter, and have I met this name before?" is
not a memory failure but the actual reading experience. If a companion earns its
place anywhere, it earns it here.

I downloaded it from the Library the way a reader would, left reading mode on
throughout, set my position to chapter 7 (Mr Fairlie's drawings), read forward
to chapter 9 inside the app, closed the browser, came back, and read on a
1280×860 laptop and at 390 / 360 / 320px.

Second book: **Dracula**, 27 chapters, set to chapter 7 (the Demeter cutting) —
chosen for a different shape (six nested map layers, real portraits, and
chapter titles that are the author's own rather than an editor's). It turned out
to be the control case that proves half the findings below.

I never once wanted to turn reading mode off.

---

## The two kinds of fault

Findings prefixed **A** are the application: PlotWeave's behaviour, controls,
layout and wording. Findings prefixed **B** are the `.pwk` content, which lives
in the PlotWeave-Library repository. Where the two combine I say so explicitly
and rank by what the reader actually suffers.

The single most important sentence in this report: **A-1, A-2 and A-4 are app
faults whose severity is set entirely by B-1.** In Dracula they are close to
harmless. In The Woman in White they end the book.

---

## A — the application got in my way

### A-1 · The search palette hands out chapter titles from the whole book

> **REJECTED — see the correction at the top.** A chapter title is on the reader's own contents page. The fault is B-1: *The Woman in White*'s titles are invented summaries.

**Cost: highest. This is the one that would have made me close the app.**

- **Screen:** anywhere in a world; `Ctrl+K`.
- **Cursor when I did it:** The Woman in White, **chapter 9** ("Walter IX: Three
  Months at Limmeridge"). Reading mode on. The dashboard at that moment read
  *"12 characters, 16 places and 9 items you have not met stay hidden."*
- **What I did:** typed `Fosco` — a name I had not read, and which the app was
  correctly hiding. I was checking whether I had met him.
- **What I expected:** nothing, or "no results", the same answer the Characters
  screen gives.
- **What happened:** six results, all chapters, all ungated:

  ```
  Ch. 23 — Marian II: Count Fosco Observes
  Ch. 55 — Walter IV: Watch on Fosco
  Ch. 56 — Walter V: Pesca Recognises Fosco
  Ch. 58 — Walter VII: Confronting Fosco
  Ch. 59 — Fosco: The Confession
  Ch. 61 — Conclusion II: Fosco's Death in Paris
  ```

  The CHARACTERS group was empty, correctly. So within one result list the gate
  held on characters and failed on chapters.

- **Reproduced:** six times, six queries, at cursor 9.
  `Percival` → `Ch. 16 — Gilmore I: Sir Percival's Explanation` (Percival is
  hidden from the cast at this cursor).
  `tombstone` → `Ch. 38 — The Tombstone at Limmeridge` — one word, and the entire
  second-epoch turn.
  `Laura` → `Ch. 18 — Laura Accepts the Marriage`, `Ch. 34 — Laura Leaves
  Blackwater`. `Catherick` → `Ch. 48`, `Ch. 51`. `Blackwater` → three.
- **Evidence:** `shots/31-s-Fosco.png`, `32-showall-fosco.png`.
- **Mechanism:** `src/features/search/SearchPalette.tsx:173-180`. The chapter
  loop matches `hit(ch.title)` unconditionally; only `ch.synopsis` is gated
  behind `chapterReached`. The comment above it states the premise:

  > *A chapter's title is printed on the reader's own contents page, so it stays
  > searchable. Its synopsis is an authored summary of what happens in it, so it
  > neither matches nor shows until the reader gets there.*

  **That premise is false for this book, and the app already knows it.** The
  Read screen's own *Contents* button, at the same cursor, lists chapters 1–7
  and stops. Two contents pages in one app, one gated and one not.
- **Mitigation that does hold:** following one of those results goes to a page
  reading *"You have not reached this chapter yet — You are reading at chapter 9.
  This page will fill in when you get here — nothing from it is shown before
  then."* So the leak is the title in the result row and nothing beyond it, which
  makes the fix narrow.

### A-2 · The Timeline lists every chapter title in the book — and it is the screen the app sends you to

> **REJECTED — see the correction at the top.** Same premise as A-1.

**Cost: very high, and unavoidable, because it is the position-setting screen.**

- **Screen:** dashboard → **Set where you have read to** (a link to
  `/timeline`). This is the primary, signposted way to say where you are.
- **Cursor:** chapter 1, one minute after downloading, before I had done anything
  at all.
- **What happened:** 62 rows, every one carrying its full title. Scrolling down
  to find chapter 7 — six rows — I passed nothing harmful. But the list does not
  stop, and I could read, from the same screen:
  `Ch. 38 — The Tombstone at Limmeridge`, `Ch. 40 — Third Epoch — Walter I:
  Laura at Her Own Grave`, `Ch. 59 — Fosco: The Confession`,
  `Ch. 60 — Conclusion I: Laura's Identity Restored`,
  `Ch. 61 — Conclusion II: Fosco's Death in Paris`.
- **Reproduced:** every visit to the Timeline, ~8 times over the run.
- **Measured on a phone (390px):** the list is 6,728px in a 653px viewport —
  **10.3 screens**, about 6 chapters per screen. Setting a position at chapter 40
  means flicking past 33 chapter titles. There is no jump-to-chapter control on
  this screen.
- **The proof that this is an oversight and not a policy:** chapter *summaries*
  on the same rows are gated exactly at the cursor. Dracula at chapter 7:

  ```
  Ch. 6 — Mina Murray's Journal
    — Mina joins Lucy in Whitby as Renfield's behavior grows more ominous.
  Ch. 7 — Cutting from "The Dailygraph," 8 August
    — A storm drives the apparently abandoned Demeter into Whitby Harbour.
  Ch. 8 — Mina Murray's Journal
    3 scenes · 6,267 words
  Ch. 9 — Mina Murray's Journal
    3 scenes · 5,909 words
  ```

  The summary disappears the instant you cross the cursor. The title never does.
- **Mechanism:** `useWorldChapters` (`src/db/hooks/useTimeline.ts:87`) is a plain
  Dexie query with no gate, unlike `useWorldEvents` two functions below it, whose
  doc comment reasons carefully that *"an event title is an authored summary of
  what happens in it … so in reading mode the list stops at the cursor."* The
  identical argument applies to a chapter title and was not made.
- **Also confirmed safe, for contrast:** clicking a future chapter row does
  nothing at all — no expand, no scenes. Only the title is exposed.

### A-3 · Nobody's description is gated, and every book in the library writes them from the last page

**Cost: high. This is the one that is genuinely half-and-half, and I want to be
precise about which half.**

- **Screen:** any character's **Overview** tab — the first thing you see when you
  ask "who is this again?"
- **Cursor:** The Woman in White, **chapter 7**. Hidden at that moment: Laura
  Fairlie, Sir Percival Glyde, Count Fosco, and 10 others.
- **What I did:** tapped Anne Catherick, because I wanted to know whether the
  woman on the Finchley Road was anybody I had met.
- **What happened:** one sentence on an otherwise empty screen —

  > *A vulnerable woman whose white clothes, **resemblance to Laura**, and
  > **knowledge of Sir Percival's secret** connect every part of the mystery.*

  Laura is hidden. Percival is hidden. "Sir Percival's secret" is the engine of
  the entire novel and is not disclosed until chapter 49. The likeness is chapter
  8 — the very next thing I had to read.
- **Reproduced in a second book at a second cursor:** Dracula, **chapter 7**
  ("The Demeter in the Storm"), Lucy Westenra's Overview reads *"Mina's closest
  friend, desired by three suitors and **preyed upon by Dracula**."* Lucy is not
  touched until chapter 8.
- **Evidence:** `shots/16-anne.png`, `shots/59-lucy-ch7.png`.
- **Why this is an app finding and not only a content one.** There is no
  mechanism anywhere in `src/` that gates a prose field. The gate hides whole
  records; it has nothing to say about the words inside one. I sampled five
  books' `.pwk` files — The Woman in White, Dracula, Pride and Prejudice,
  Frankenstein, The Moonstone — and **all five** write descriptions from the end
  (*"whose judgments of Darcy and Wickham must be revised"*; *"driven from
  sympathy toward vengeance"*; *"isolated by shame and driven by unreturned
  devotion to protect Franklin"*). So this is not one book being careless. It is
  a shape the format invites and the app cannot defend against, while the Library
  dialog promises *"Set the chapter cursor to where you are and the app will only
  tell you what is true by then."*
- **Second-order cost:** the Overview tab is *also* the emptiest screen in the
  app — one line of text and roughly 600px of nothing below it. So the screen I
  opened to ask "who is this again" answered with a spoiler and no context, and
  the actually-useful answers (Appearances: *Ch. 4, Ch. 5*; History: *"Escapes
  along the road in white"*) were one tab further on.

### A-4 · The Character Arc opens onto the whole book

> **REJECTED — see the correction at the top.** Same premise as A-1.

- **Screen:** dashboard → **Character Arc** card (one click).
- **Cursor:** chapter 7, The Woman in White.
- **What happened:** a grid of 5 rows × **62 columns**. Cells past the cursor are
  correctly blank (`–`). The column *headers* are not: scrolling right gives
  `Ch. 59 Fosco: The Con…`, `Ch. 60 Conclusion I: …`, `Ch. 61 Conclusion II:…`.
  Fifty-five of the sixty-two columns are empty, so a reader's Arc view is
  mostly a horizontal scroll through titles they have not earned.
- **Reproduced:** twice. **Evidence:** `shots/21-arc.png`, `shots/22-arc-right.png`.
- Same root cause as A-2 — an ungated chapter list.

### A-5 · A tab says "Goals 2" and the panel says "No goals yet"

**Cost: moderate, and the cost is trust.** This is the shape the brief calls out:
I could not tell whether the record was empty or whether the app was hiding it.

- **Screen:** Walter Hartright → **Goals**. Cursor chapter 7.
- **What happened:** the tab is labelled `Goals 2`. The panel behind it reads
  **"No goals yet — Track what this character wants, needs, fears, and what flaw
  holds them back — the inner life behind their scenes."**
- **Reproduced:** Walter (badge 2 → nothing) and Marian Halcombe (badge 1 →
  nothing), at both chapter 7 and chapter 9. Anne Catherick's badge of 1 *does*
  show its goal, so the gate is working — only the count disagrees with it.
- **Evidence:** `shots/18-goals-walter.png`, `shots/18-goals-marian.png`.
- **Mechanism, exactly:** `GoalsTab.tsx:178` filters
  `goals.filter((g) => gate.hasReached(g.startEventId))`. But
  `CharacterDetailView.tsx:88` builds `tabCounts.goals = goals.length` from the
  **ungated** `useGoalsForCharacter`, and `hasTab` offers the tab whenever that
  count is non-zero. The file's own comment two lines above says *"while reading,
  a tab with nothing behind it is not offered"* — and the branch that produces
  exactly that state is reachable and I reached it. (The data supports doing this
  right: every goal in the file carries a `startEventId`. Walter's two start at
  chapters 40 and 41.)
- **Second half of the same fault:** the empty-state *sentence* is written to a
  novelist. The **Add a goal** button is correctly suppressed in reading mode
  (`EmptyState` drops its action behind `!gate.active` — good), but the prose
  telling me to track someone's flaws is not. The Factions screen does the same:
  `"Factions are organizations characters can belong to — kingdoms, guilds,
  cults. Optional, but powerful for political stories."` — offered to a reader,
  on a screen that says `Factions 0`, while Walter's own page carries a
  `Factions 1` tab.

### A-6 · In the Read panel, the person's name is not a link

**Cost: moderate, and it happens at the exact moment the app is most useful.**

- **Screen:** Read → the **IN THIS SCENE** panel.
- **What I did:** clicked the words "Marian Halcombe".
- **What happened:** nothing. Twice. The row lights up under the cursor
  (`hover:bg-accent/0.4` is on the whole `<li>`), so it reads as a target.
- **What actually works:** a 22×22px eye icon at the far right of the row,
  measured at `x:1233 y:341 w:22 h:22` on a 1280px screen. Clicking it goes to
  `/characters/woman-in-white-character-marian`.
- **Reproduced:** twice on desktop; the phone drawer uses the same markup, with
  the eye at x≈367 in a 390px viewport — flush against the screen edge.
- **Mechanism, and it is a deliberate trade:** `SceneXRay.tsx:111-147`. The doc
  comment says *"the whole row used to be a link, and a zoomable image inside it
  would have stolen the click, which `imageLightbox.spec.ts` exists to prevent."*
  The portrait was made zoomable and the row was demoted to a `<li>` with a
  separate `<Link>`. The hover affordance stayed behind on the dead element.
- 22×22 is under the WCAG 2.5.8 minimum of 24×24, and far under any touch
  guidance.

### A-7 · The reading-mode banner runs off the side of the phone

- **Screen:** world dashboard, the *"Reading mode is on"* card — the first screen
  a reader lands on after downloading a book.
- **Measured** (`document.scrollWidth === clientWidth` at all three widths, so
  the page does not scroll to reach it — it is simply gone):

  | viewport | card right edge | "Turn it off in settings" right edge | off-screen by |
  |---|---|---|---|
  | 390px | 366 | 445.9 | 56px |
  | 360px | 336 | 445.9 | 86px |
  | 320px | 296 | 445.9 | **126px** |

  At 320px the *primary* button, "Set where you have read to", is also clipped at
  the card border.
- **Reproduced:** 3/3 widths. **Evidence:** `shots/41-dash-320.png`,
  `shots/41-dash-390.png`.
- **Mechanism:** `WorldDashboardView.tsx:476` —
  `<div className="flex shrink-0 flex-wrap items-center gap-2">`. `shrink-0`
  pins the group at its max-content width, so its own `flex-wrap` can never fire.
  The group does wrap onto its own line (as the comment above it intends) and
  then overflows horizontally instead of wrapping within itself.

### A-8 · "Maps 1 — maps you have reached", and then six maps

- **Screen:** dashboard card vs. the Maps sidebar. Dracula, chapter 7.
- The card says **1**, described as *"maps you have reached"*. The Maps screen
  lists six layers I can open: Europe c. 1890; Victorian London c. 1890;
  Seward's Asylum; Transylvania, Hungary and Galicia; Castle Dracula — Ground
  Floor; Whitby 1890.
- **Mechanism:** `WorldDashboardView.tsx:81` uses `useRootMapLayers`, and line
  279 relabels it for readers as *"maps you have reached"*. The number is root
  layers; the reader's word "maps" means something else. The sidebar header does
  the same (`MapSidebar.tsx:419`, `count={roots.length}`) — it reads
  `MAP LAYERS 1` above five visible names.
- A reader glancing at the dashboard concludes there is one map and does not
  open it.

### A-9 · The Read screen puts the whole novel in the page, then clamps the scroll

- **Measured:** at cursor 7, the manuscript container's `scrollHeight` is
  **607,995px** and `main.innerText` is **1,351,185 characters**, containing all
  62 chapter headings and ending on *"Marian was the good angel of our lives—let
  Marian end our Story."*
- **The clamp is real and it works.** Setting `scrollTop = scrollHeight` — a
  thumb-flick to the bottom — did not land me in chapter 62; it landed me in
  chapter 8, one past my cursor, and moved the cursor there. Wheeling hard for
  thirty notches advanced me by one chapter, not fifty. I tried this four times
  and never got further than cursor+1. That is the right behaviour and I want to
  be clear that I could not break it.
- **What remains:** the text is nonetheless in the document. The Contents list is
  gated to chapter 7 while chapter 8's prose is 800px below chapter 7's last
  line. Initial route load took **3.8s** on this machine at 1280px.
- **Cost: low as a spoiler risk, unknown as a phone-performance risk.** See the
  guesses section.

### A-10 · Two 16-pixel controls, side by side, one of which is "show me the ending"

- **Screen:** the chapter bar, bottom-left, every screen.
- `Clear selection` — **16×16px** at x=58 — sits 18px from `Hide the chapter bar`
  — **17×17px** at x=76.
- I tapped it. **It asked**: *"Show the whole book? — Viewing all chapters drops
  back to the full world — every character, place and subplot, including the ones
  the story has not introduced yet. Step the cursor instead to keep reading
  spoiler-free."* The top bar's equivalent (now labelled "View all chapters")
  asks the same. **Both doors are genuinely closed** — I confirmed this
  deliberately because `useRevealAll.tsx` records two earlier runs finding them
  open, and they are not open now.
- What is left is the target size (WCAG 2.5.8 wants 24×24) and the label:
  "Clear selection" does not tell a reader that the thing it clears is their
  place in the book.

---

## B — the book's data got in my way

These are fixed in PlotWeave-Library, not here.

### B-1 · The Woman in White's chapter titles are invented, and they are summaries

Collins numbered his chapters. He did not call chapter 59 *"Fosco: The
Confession"*. Every title in this `.pwk` is editorial, and they are written as
one-line spoilers: *The Tombstone at Limmeridge*, *Laura at Her Own Grave*,
*Laura's Identity Restored*, *Fosco's Death in Paris*, *The Vestry Fire*,
*Anne's Parentage*.

This is what makes A-1 and A-2 catastrophic rather than cosmetic. **In Dracula
the same two code paths leak nothing worth having**, because Stoker's chapter
headings really are *"Dr Seward's Diary"* and *"Mina Murray's Journal"* and they
really are on the contents page. The app's premise — *"a chapter's title is
printed on the reader's own contents page"* — is true for Dracula, Moby-Dick and
Alice, and false for Collins, Austen, Stoker-adjacent Victorian serials and
anything else numbered rather than named. The app cannot tell which it has: the
chapter record carries `title` and `summary` and nothing distinguishing an
authorial title from an editorial one.

### B-2 · Descriptions are written from the last page (all five books sampled)

See A-3. The clean fix is on this side — describe someone as the reader first
meets them — but the format has no per-cursor description field, so today this
can only be done by writing the description at first-appearance strength and
losing it for writers.

### B-3 · The world blurb on the dashboard is a back-cover summary

Dracula's dashboard, at chapter 1, before I had read a word in the app: *"As
Lucy Westenra falls under his influence and Mina Harker becomes his next target,
a group of friends unites its knowledge, faith, and courage to hunt him back
across Europe."* The Woman in White's names Anne Catherick and the identity
plot. Arguably fair — it is the blurb, and readers buy books having read blurbs —
but it is on every screen load, under a banner that says things are being hidden.

### B-4 · Anne Catherick's goal starts at chapter 4 and names two hidden people

`Warn Laura about Percival before he can silence her.` — `startEventId` resolves
to chapter 4, so the gate correctly shows it at my cursor of 7. At chapter 7
Walter has not met Laura and has never heard of Percival. The record is gated
properly; its *wording* reaches past its own start. The app cannot scan prose for
names (see A-3), so this has to be fixed in the text.

### B-5 · A knowledge fact points forward

`Anne resembles Laura — Walter recognizes the likeness on meeting Laura; its
family cause is learned later.` The last four words tell me there is a family
cause. That is the reveal.

### B-6 · Mina's name field is her married name at chapter 7

The Dracula cast list at chapter 7 reads `Wilhelmina "Mina" Murray Harker`. She
is Miss Murray for another three chapters. Small, but it is in the roster, and
the roster is the thing a reader consults precisely because they are unsure who
somebody is.

---

## What I only suspect — kept separate, and unproven

- **Browser find (`Ctrl+F`) on the Read screen would surface chapter-62 text.**
  I confirmed the DOM contains it (1,351,185 characters of `innerText`); I did
  not drive a real find bar, which headless Chromium does not give me. A guess.
  Likewise select-all-and-copy, and a screen reader walking the document.
- **The 1.35M-character manuscript may be slow or memory-hungry on a real
  phone.** I measured 3.8s to first paint on a desktop-class machine with no CPU
  throttling. I did not throttle, and I did not test a real device. A guess.
- **The cursor advancing on scroll could be triggered by an accidental flick.**
  My scrolls were programmatic and wheel events. The behaviour itself is right —
  reading forward *is* reading — but I have not established what a fumbled thumb
  does on a touchscreen. A guess; settle it with a real device or Playwright
  touch emulation with inertia.
- **Whether A-2's severity holds across the catalogue.** I checked two books
  properly and read titles from three more files. Settling it is cheap: scan all
  44 `.pwk` files and flag any whose chapter titles contain a verb.

---

## What worked, and should survive any fix above

This list is not padding. Several of these answered a question faster than
flicking back through the paperback, which is the entire point.

1. **Download → read, with nothing in between.** Library → search "woman in
   white" → Download → I was on the world dashboard with reading mode already on
   and the cursor at chapter 1. No settings, no wizard, no decision to make.
2. **Saying where I am costs three clicks.** *Set where you have read to* →
   *Read to here* on the chapter 7 row → *Read ahead*. The confirm is well
   judged: `asksBeforeJumping` never asks for the next chapter and never asks
   going backwards, so ordinary reading is silent and only a jump interrupts.
   The dialog's wording — *"Coming back hides them again"* — says what happens
   rather than threatening.
3. **The Read screen is the best thing in the app.** It opened at my chapter,
   said *"5% of the book · Chapter 7 of 62 · about 12 min left in it"*, and as I
   read forward the cursor followed me, the chapter bar filled in behind me, and
   the **IN THIS SCENE** panel updated to *Walter Hartright / Laura Fairlie /
   Marian Halcombe — Cumberland Coast*. Its **Contents** list is gated to the
   cursor. And the scroll is clamped to cursor+1, so I could not accidentally
   fall into the ending. That combination is exactly right.
4. **The gated chapter page.** *"You have not reached this chapter yet. You are
   reading at chapter 9. This page will fill in when you get here — nothing from
   it is shown before then."* Unambiguous: it tells me the thing exists, that it
   is hidden, and why. This is the sentence A-5's Goals tab should be saying.
5. **Knowledge answered "who else knows?" in two clicks.** At chapter 9: *"Anne
   escaped from a private asylum — known by 1 / 6"* → *"KNOWN BY (1): Walter
   Hartright, Ch.5"*. Correct, gated, and faster than I could have found it in
   the book.
6. **Coming back the next evening.** Fresh browser process, shelf card reading
   **"The Woman in White · Chapter 9 of 62"** with a progress bar, one tap to
   resume. My place was never lost across eight separate browser launches.
7. **The gate holds on every screen that matters.** Characters, History,
   Appearances, Relationships, Calendar (stopped dead at 5 August 1849), Items,
   Lore, map markers, map layers, chapter summaries, knowledge facts, goal start
   events — all gated, all consistent, all at the right chapter. Dracula's
   Captain of the Demeter shows *deceased* at chapter 7 and not before.
8. **Both reveal-all doors ask first.** Previously-closed findings, re-checked
   on purpose, and genuinely closed.
9. **Settings in reading mode is three sections** — Reading mode, Pictures,
   Theme — and nothing else. The writer's world is properly put away.
10. **The offline map message.** *"This map's picture could not be loaded — it is
    kept on the web rather than in the book, so it needs a connection. Everything
    marked on the map is still here."* That last clause is the difference between
    a broken screen and a degraded one.
11. **Reading on a phone is pleasant.** 390px gives comfortable measure, the
    scene panel folds into a drawer, the font and spacing controls are right
    there. A-7 is the only thing wrong with it.

---

## Verdict

> **The "no" below rests on A-1, which was rejected.** With that removed the answer is the one this section gives for a clean book: yes.

**Is this a good application to read a book with?**

Yes — for Dracula. No — for the book I actually chose, and it is not close.

The reading engine is genuinely good. The Read screen, the cursor that follows
your scroll and clamps at one chapter ahead, the three-click way to say where you
are, the shelf that still knows your place a week later, the gate holding on
eleven different screens including ones nobody would think to check: that is a
companion doing its job, and none of it should be disturbed by fixing anything
above.

But I read The Woman in White for two hundred pages of app time, and at chapter 9
I typed one name into the search box and was told that Fosco confesses and then
dies in Paris. Nothing in the app is more natural for a reader to do than type a
name they half-recognise. The promise on the Library dialog — *"the app will only
tell you what is true by then"* — was broken by the single most common action a
confused reader performs.

**Split fairly:**

- **With a clean book** — one whose chapter titles are the author's and whose
  character descriptions are written at first meeting — the answer is **yes, and
  well ahead of flicking back through the paperback**. A-1, A-2 and A-4 would
  leak nothing of consequence; A-3 would not arise. What would remain are A-5
  through A-10: a wrong tab count, a dead name row, a banner hanging off the edge
  of a phone, an undercounted map card. Annoyances, not injuries.
- **As shipped, with the catalogue as it stands**, the answer is **no for the
  Victorian novels that make up most of the library**, because the app's
  load-bearing assumption — that a chapter title is public information — is false
  for them, and because the description field on every character page in every
  book I sampled is written from the last chapter.

The distinction matters for who fixes what, and it cuts both ways. Fixing B-1
alone would rescue one book. Fixing A-1 and A-2 alone would rescue every book,
including ones not yet written, and would cost less than the comment currently
justifying the behaviour. Do A-1 first; it is one `chapterReached.has(ch.id)`
away and it is the one that ended my evening.
