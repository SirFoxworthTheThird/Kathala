# A morning's work in PlotWeave — writer run, 17 Aug 2026

Second writer's-eye session. Everything below happened in the app built from
`48d2e61` (`npm run build`, served by `vite preview`) and driven with Playwright
from a scratch directory, at 1440×900 unless a phone width is named.

The 16 Aug run spent its morning on the core loop, so this one deliberately went
elsewhere: **manuscript import** as the way in, the **return** case with a cold
head, **volume** (two library worlds, 61 chapters), the **long-tail screens**
(continuity, corkboard, calendar, structure, arc, diff, manuscript, export/import
round trip), and the **phone** at 390×667 and 360×640 with touch.

None of W-1..W-13 / WRUN-1..WRUN-14 is re-filed. Two of them I re-checked in
passing and they hold; that is in *What worked*.

---

## What I set out to do, and how far I got

1. **Start from nothing.** I have three chapters in a text file, so I used
   **Import Manuscript** rather than the wizard. 3 chapters, 7 scenes, 403 words,
   in one paste. Then three characters, cast on every scene, all seven scenes
   retitled, one secret with three reveals. Done.
2. **Come back to it.** Closed the browser between every leg and reopened cold.
   Done, and it works well — see *What worked*.
3. **Ask a real question.** *"Who knew by then?"* at Ch.3 — answered by the
   Writer's Brief in one click and 1.85 s. Done, with a caveat in *suspicions*.
4. **Bring in real material.** Downloaded *Harry Potter* and *Pride and
   Prejudice*, turned reading mode off on P&P, and worked in it as mine —
   including pasting a page of Austen into a scene, which is where F-4 came from.

I got the morning's work done. Three things stopped me hard enough that I would
change how I work around them, and one of those (F-2) lost me prose while I was
measuring something else.

**Every number below was measured in the running app.** The section *Five things
I thought I had found, and didn't* is not decoration — two of them were mine, and
one of them was a screenshot lying to me.

---

## What stopped me

Ranked by what it costs a writer.

---

### F-1 · high · The app blocks its own first paint on a Google font it never uses

**What I did.** Nothing special — I loaded the app. My sandbox routes outbound
HTTPS through a proxy that holds the connection to `fonts.googleapis.com` and
then resets it. Every navigation took about thirteen seconds and showed nothing
at all until it finished.

**What I expected.** A local-first app with no backend to open at local speed.

**What happened.** `index.html:10` is a render-blocking third-party stylesheet:

```html
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&display=swap" />
```

First paint tracks that request exactly. Four runs, same build, same route
(`/timeline`), differing only in how the font request resolves:

| condition | `first-paint` |
|---|---|
| as shipped, run 1 (proxy holds, then resets) | **12 992 ms** |
| as shipped, run 2 | **12 936 ms** |
| request refused instantly (`route.abort`) | **124 ms** (FCP 292 ms) |
| host holds the connection for 25 s | **25 228 ms** |

At `t = 5000 ms` in the held case, `performance.getEntriesByType('paint')` is
**empty** — the browser has painted nothing. The React tree is already there
(`#root` has children, the top bar and a spinner are in the DOM); it is simply
not on screen.

**The font is not used.** `Playfair` appears nowhere in `src/` and nowhere in the
built CSS — only in `index.html` (and its copy in `dist/`). Every theme's stack
is system fonts: `src/index.css:27` `ui-sans-serif, system-ui`, `:68` `Georgia,
'Palatino Linotype'…`, `:175` `'Segoe UI', Arial`, `:243` `Georgia, 'Times New
Roman'`. So the app waits for a typeface it will not use.

**It ships in the desktop app too.** `electron/main.cjs:35` loads
`dist/index.html`, so the packaged Electron build makes the same request on
launch and blocks the same way.

**Cost.** This is not only my sandbox. It is every writer on a plane, on a train,
behind a corporate proxy, in a country that blackholes Google, or on a hotel
captive portal — precisely the offline situations a local-first, IndexedDB-only
writing app exists to survive. In the *held* case the app never appears at all;
the user sees an empty window and concludes it is broken. It is also a privacy
claim: `docs/ux-review.md` **WRUN-13** decided, deliberately, to keep the
Library's third-party cover fetches — but that is one dialog, opt-in. This is
every load of every screen, including the desktop build.

**Not in `docs/ux-review.md`.** Searching it for `font`, `offline`, `first paint`
and `blank screen` returns nothing on this.

---

### F-2 · high · The Scene Draft box saves only on blur, and there is nothing to tell you

**What I did.** In *Pride and Prejudice*, opened Ch.1 → *Netherfield Is Let*,
typed a sentence into **Scene Draft**, and left the page four different ways.
Four trials, one script, checking `sceneTexts` in IndexedDB afterwards:

```
A: click the Characters nav link      stored: 1 (23 words)
B: reload the page                    stored: 0
C: navigate away (= close the tab)    stored: 0
D: press Escape, then reload          stored: 0
```

**What I expected.** That the box holding the novel behaves at least as well as
the box next to it holding my notes.

**What happened.** `SceneDraftSection.tsx` wires `onBlur={saveScene}` and nothing
else — no debounce, no interval, no save on unmount, and there is no
`beforeunload` handler anywhere in `src/`. The word count updates live as you
type, which reads exactly like a commit.

**The same screen does it right twice.** *Writer's Notes*, in the right-hand
column of the very same view, debounces at 600 ms
(`ChapterDetailView.tsx:159-166`) and says **"Auto-saved"** under the box
(`:338`). **Focus mode** — the distraction-free editor for the same field —
autosaves at `AUTOSAVE_MS = 1000` and flushes on unmount
(`FocusMode.tsx:19,42-49`). So of the three text areas a writer touches, the one
that holds the prose is the only one that can lose it, and it is the only one
with no label saying what it does.

**Cost.** I lost 102 words of pasted Austen to this without noticing, and only
found out because a *different* measurement (F-4) came back empty and I went
looking for why. The amount at risk is unbounded — everything typed since the
last blur. A writer who types a scene and closes the laptop has typed nothing.

**Not in `docs/ux-review.md`.** `HB-7a`, `OP-1` and `OP-8` are the nearest
relatives (form state lost on close) and none of them is this field.

---

### F-3 · high · Importing a `.pwk` silently destroys the world it lands on

**What I did.** Exported a world (`Ninth_Bell_Backup.pwk`). Then went back into
it and renamed a scene through the UI to `TODAY'S WORK — do not lose me`. Then
**Import World → Choose file →** that same backup, as anyone restoring a backup
would.

**What I expected.** To be asked. "This file is a world you already have — merge
or replace?" is the question, and the app knows how to ask it.

**What happened.** No dialog, no confirm, no toast. The file picker closed and
the app navigated straight into the world's dashboard with my edit gone:

```
after edit:   … | TODAY’S WORK — do not lose me
after import: … | Scene 1
```

**Mechanism.** `WorldSelectorView.processFiles()` calls `importWorld(file)` with
no id-collision check; `importWorldData(data, replaceExisting = true)` then runs
a `.where('worldId').equals(…).delete()` over **every** table for that world id
before writing the file's contents.

**The app already knows this is dangerous — for the other door.**
`LibraryDialog.tsx:74-84`:

```
/**
 * Import reuses the world id in the file and replaces whatever is under it,
 * so re-downloading a world the reader already has would throw away any
 * notes they had made in it. Ask first.
 */
function start(entry, withImages) {
  if (installedWorldIds.has(entry.worldId)) { setConfirming({ entry, withImages }); return }
```

The Library asks. The generic importer, which is where a writer's *own* backups
go, does not — and a writer restoring a backup is by definition someone who
already has that world.

**Cost.** The one gesture whose whole purpose is safety is the one that can eat a
day's work, and it is irreversible: `markJournalDiscontinuity` aside, there is no
undo across an import.

---

### F-4 · med-high · The prose-to-cast link matches only the first word of a name

This one has two halves and both are reproduced in the running app.

**Half 1 — it misses the way fiction actually refers to people.** My Ch.2 scene
*"Sarn reads the ledgers"* is 26 words, and two of them are `Sarn`:

> *Sarn read the yard's ledgers until midnight and found nothing, because there
> was nothing in them. He wrote in his own book:* the rope was wet.

Expanded, the card offers **no** *"In the text but not on this event"* row at all,
where the Ch.1 card offers `+ Ilva Marrow` from the same feature. To cast him I
had to reveal `+ Characters` and use the picker — three extra interactions per
scene.

The Continuity Checker inherits it. With Teodor removed from that scene's cast, I
reran the checker: **5 warnings, PROSE VS. RECORD = 1**, and the one is
*"Ilva Marrow is named in the prose but not in the cast of 'Sarn comes to the
yard'"*. Same rule, same run, same world: the first-name reference is caught, the
surname reference is not.

**Half 2 — and it fires on people who are not there.** In *Pride and Prejudice*
(reading mode off, used as mine) I pasted the opening of Chapter 1 — 102 words
naming exactly two women, **Mrs Bennet** (already in the cast) and **Mrs Long**
(not a character in the world). The card offered **seven** chips:

```
In the text but not on this event:
+ Mrs Forster  + Mrs Gardiner  + Mrs Hill  + Mrs Jenkinson
+ Mrs Philips  + Mrs Reynolds  + Mrs Younge
```

Every one of them wrong, all from the single token `Mrs.` in *"for Mrs. Long has
just been here"*.

**Mechanism.** `src/lib/manuscript.ts:41-44`:

```ts
const firstToken = name.split(/\s+/)[0]
const alias = firstToken.length >= 3 ? firstToken : name
const re = new RegExp(`\\b${escapeRegExp(alias)}\\b`, 'g')
```

`Mr` (two characters) falls back to the full name and is safe; `Mrs`, `Lady`,
`Miss`, `Sir`, `Master`, `Captain`, `Colonel`, `Professor`, `Monsieur` and `The`
do not. `detectMentions` feeds both the nudge chip (`SceneDraftSection.tsx:46`)
and the checker (`proseContinuity.ts:81`).

**Scale.** Across the 25 shipped `.pwk` worlds, **131 of 760 characters (17 %)
share an alias with at least one other character**, in **24 of the 25 worlds**:
9 `Master …` in *The Name of the Wind*, 8 `Mrs …` in *Pride and Prejudice*, 11
`The …` in *The Time Machine*, 3 `Captain …` in *Twenty Thousand Leagues*. That
number is **latent** on the library as shipped, because those worlds carry
**0 `sceneTexts`** — the rule only fires once prose exists. The population that
meets it is precisely the writers who came in through *Import Manuscript* or who
type in the Scene Draft box, i.e. the ones using the app for its stated purpose.

**Cost.** The half that misses costs three clicks per scene and, worse, makes a
checker that reports *"no drift"* when there is drift. The half that over-fires
puts seven wrong names under the writer's own paragraph, each one a button that
adds a wrong character to the scene with one click.

---

### F-5 · med · At 360 px the time cursor shows no text at all

**What I did.** Opened a chapter at four phone widths and measured the cursor
pill's label span.

```
390×667  visible "Ch.1"  pill 63px  span scrollWidth 30 / clientWidth 25
360×640  visible "Ch.1"  pill 33px  span scrollWidth 30 / clientWidth  0   ← nothing rendered
320×568  visible "Ch.1"  pill 33px  span scrollWidth 30 / clientWidth 15
414×896  visible "Ch.1"  pill 68px  span scrollWidth 30 / clientWidth 30
```

The screenshot of the 360 px top bar is a hamburger, the logo, `‹ 🕐 › ✕`, undo,
redo, search — and the pill contains **only the clock glyph**. `Ch.1` is in the
DOM and in the `title`, and none of it is on the screen.

`TimeCursor.tsx:119-121` reasons that *"'Ch.4' tells you where you are; the clock
does not"* and keeps the number while dropping the event title below `sm`. The
number does not survive either: the pill is `min-w-0` in a flex row that now also
carries undo, redo and search, so at 360 px it is squeezed to 33 px and the label
is clipped to zero.

**Cost.** 360 CSS px is not exotic (Galaxy S8/S9/S10e and most mid-range
Androids). On those phones the app's central concept is invisible, and "cursor on
Ch.1" and "viewing all chapters" are distinguishable only by the pill's border
colour and the presence of the `✕`. `PH-2` measured and fixed the step *buttons*
at 390 px; the label was not measured.

---

### F-6 · med · The scene title commits only on the check button — Enter and blur both do nothing

**What I did.** Chapter detail → expand a scene → **Edit title & description** →
type a title → press **Enter** → move on.

**What happened.** Nothing at all. The field stays, the title is not written, and
navigating away discards it:

```
A: press Enter, then navigate away      → DB titles unchanged
B: click into the prose box (blur)      → DB titles unchanged (field keeps the text)
C: click the ✓ Save button              → written
```

`EventCard.tsx:321-328` renders the title `Input` with `value`, `onChange`,
`aria-label` and `autoFocus`, and **no `onKeyDown` and no `onBlur`**. The chapter
rename on the Timeline screen — the next thing up the same page — commits on
both (`TimelineView.tsx:301-303`: `onBlur={commitRename}` and
`if (e.key === 'Enter') commitRename()`).

**Cost.** My first pass at retitling the seven scenes imported as *Scene 1..3*
was 34 interactions over 46 s, and **not one title was saved**. I only found out
by dumping the events table; the screen gave no error and no changed state. At a
novel's length that is the whole retitling pass.

---

### F-7 · low-med · The Chapter Diff elides two thirds of every line it exists to show

`Compare chapters` on *Pride and Prejudice*, Ch.1 → Ch.2, in a dialog **672 px**
wide. Each side of each changed note is rendered in a **120 px** cell with no
`title` attribute:

```
scrollWidth 311 / clientWidth 120   "Teasing his wife by withholding whether …"
scrollWidth 240 / clientWidth 120   "Enjoying the surprise produced by his se…"
scrollWidth 331 / clientWidth 120   "Treating Bingley’s arrival as an urgent …"
scrollWidth 364 / clientWidth 120   "Transforming irritation into triumph as …"
```

61–67 % of each sentence is unrecoverable, and the panel's whole purpose is to
show what changed between two chapters. The `new` / `removed` rows are fine; it
is only the `Notes` diff, which is the interesting one.

---

### F-8 · low · "Known by" is in database order

Recording who learns my secret, I entered Teodor (Ch.1), then Kel (Ch.2), then
Ilva (Ch.3). The panel lists:

```
KNOWN BY (3)
Ilva Marrow        Ch.3 — On the stair
Teodor Sarn        Ch.1 — Ilva climbs to the ninth bell
Grandmother Kel    Ch.2 — Kel remembers the flood
```

Neither story order nor entry order. `KnowledgeView.tsx:114` is
`reveals.filter((r) => r.factId === selectedId)` with no sort, and `reveals`
comes from a Dexie live query — the same class **WRUN-3** fixed for the three
pickers, in the one list on the screen that answers *"who knew by then"*. Across
the shipped library, **83 of 287** facts with reveals have three or more knowers
(max 11, in *Fellowship*), so it does not stay a three-line list.

The `Learns it at…` picker beside it **is** in reading order — I checked, and
WRUN-3 holds.

---

## What I only suspect

Kept separate: none of these is reproduced to the standard above.

**S-1 · The Writer's Brief's "who knows" line reads like a complete answer and is
not.** At Ch.3 · *On the stair* the brief says:

> `Sarn wrote the letter and signed her mother's name` — **WITHHELD** —
> *Ilva Marrow, Teodor Sarn know — the reader doesn't yet.*

Grandmother Kel also knows by then; she learned it in Ch.2. The code is right and
says so — `knowledgeGaps.ts:10` documents `knownBy` as *"Present character ids
who know the fact at the cursor"*, and a gap is by definition between the reader
and the people on stage. But the sentence on screen does not contain the word
"present", and *"who else knew by then"* is the question I opened the panel to
ask. **What would settle it:** show two writers the panel and ask them who knows
the secret at that moment. If they answer "Ilva and Sarn", the wording is doing
harm; if they answer "the two in the scene", it is fine.

**S-2 · Manuscript import gives every scene a name that is not a name.** My seven
scenes arrived as *Scene 1, Scene 2, Scene 3* per chapter, so *Recently edited*
showed five rows reading `Scene 2 / Scene 1 / Scene 3 / Scene 2 / Scene 1`,
separated only by their chapter line, and the cursor pill and every picker would
have carried the same. It is arguably unavoidable — the importer cannot know a
scene's title — but the first line of prose is right there, and F-6 makes fixing
it by hand expensive. I have not established that writers mind. **What would
settle it:** import a 40-scene manuscript and try to find one particular scene
from the dashboard.

**S-3 · The `Select` trigger has no listbox semantics.** `ui/select.tsx` gives
the popup `role="listbox"` and its items `role="option"`, but the trigger is a
plain `<button>` with no `role="combobox"`, no `aria-haspopup`, no
`aria-expanded`, no `aria-controls`. Named and operable, so it is not a blocker;
a screen-reader user is simply not told it opens a list. I did not test with a
screen reader, which is what this needs. Nothing in `docs/ux-review.md` mentions
`combobox` or `listbox`.

**S-4 · The continuity checker double-reports a character with no snapshots.**
On my freshly-imported world it produced both *"Ilva Marrow appears before any
snapshot record"* and *"Ilva Marrow's state may be stale (5+ events without
update)"* — two rows in two categories about the same absence. Five warnings on a
world where I had recorded nothing yet may just be the checker doing its job; I
have not looked at how it reads once one snapshot exists.

**S-5 · A `⋯` menu whose only item is "Delete chapter".** On the Timeline, the
per-chapter overflow opens a one-item menu, and the item is the destructive one.
Two taps to a delete, behind a control that promises choices. Small, and possibly
deliberate.

---

## What worked

Honestly, and there is a lot of it.

- **Import Manuscript is the best front door in the app.** Paste, and before you
  commit to anything it tells you what it will make: *"3 chapters · 7 scenes · 403
  words"*, then `Ch. 1 The Ninth Bell — 2 scenes` / `Ch. 2 What the Salt Kept — 3
  scenes` / `Ch. 3 Low Water — 2 scenes`, and the button relabels itself **Import
  3 chapters**. It split my `* * *` breaks exactly right, kept the separators out
  of the stored prose, and did not invent a scene. That is a preview that earns
  trust before it asks for it.
- **The expanded scene card is the best screen in the product.** Prose, live word
  count, the mention nudge, description, cast, POV, elapsed time, tension, status
  — all on one card, with the *Character States* column beside it updating the
  instant I added someone (*"in the scene, no state recorded"*, which is the HB-1
  fix doing exactly what it should).
- **Coming back cold is genuinely good.** One click from the world list, and the
  time cursor was where I left it — the store keeps it **per world**
  (`eventByWorld`), so switching worlds does not scramble it. *Recently edited*
  gave me five scenes with chapter attribution and *"just now / 6m ago / 15m
  ago"*. That is a resume surface, not a dashboard.
- **The world list has grown up.** `YOUR WORLDS` / `READING`, and the reading
  world carries *"Chapter 1 of 17"* with a progress bar. Turning reading mode off
  on *Pride and Prejudice* moved its card from one group to the other, which is
  the right instinct.
- **Volume is not a problem.** *Pride and Prejudice*, 61 chapters and 86 scenes:
  Timeline **1 251 ms**, Corkboard **649 ms**, Arc **1 190 ms**, Continuity
  **3 135 ms**. The pacing curve across 61 chapters is the best thing on that
  screen and it scrolls rather than shrinking (WRUN-14 holds at both ends — my
  3-chapter draft got a proportionate small chart).
- **`MIGHT ALSO KNOW`** on the Knowledge panel — *"Fitzwilliam Darcy — with
  Elizabeth Bennet in Ch. 3 · + learned it"* — is the smartest suggestion in the
  app. It reasons from co-presence, and one click records the reveal.
- **The Continuity Checker's bulk remedy.** *"Record initial state for all 3"* at
  the top of the group, with *"Record initial state here"* on each row. HB-1a's
  fix, and it is the difference between a warning and a to-do list.
- **Deletion and destruction are named everywhere else.** The Library asks before
  overwriting; `View all chapters` asks before spoiling a read; chapter delete
  names the chapter. F-3 stands out precisely because it is the exception.
- **Reading mode explains itself.** *"You are reading up to chapter 1, so 47
  characters, 39 places and 16 items you have not met stay hidden…"* with a
  one-click route out, and a per-world theme that makes the two modes feel
  different.
- **Nothing overflowed at any phone width I tried** (390, 360, 320:
  `scrollWidth === clientWidth` throughout, including with a scene card expanded),
  and the chapter-detail editor at 390 px is genuinely usable — a 332×130
  textarea with Focus one tap away. That was on the *Still not reviewed* list;
  apart from F-5 it comes off it clean.

---

## Five things I thought I had found, and didn't

The value of the list above depends on this one existing.

1. **"Export drops all the scene prose."** The `.pwk` came out with
   `sceneTexts: 0`. It was **my own cleanup script**, which did
   `objectStore('sceneTexts').clear()` — the whole table, not one world. Re-run
   properly on a fresh import, the export carries all 7 (`events 7, chapters 3,
   sceneTexts 7`). My data loss, not the app's.
2. **"Export world does nothing."** Clicking the export icon produced no file and
   no error for 40 s. `exportImport.ts:349` uses `showSaveFilePicker` when
   available, which cannot open in headless Chromium. Deleting the API in an init
   script made the fallback path fire and the file downloaded immediately. A
   harness artefact; there is nothing here to fix.
3. **"The app paints fine while the font hangs — I have a screenshot."** I did,
   at `t = 3000 ms`, showing the top bar. **Taking a screenshot forces a frame.**
   Probing `performance.getEntriesByType('paint')` *before* screenshotting returns
   `[]` at 5 s, and the same probe after the screenshot reports `first-paint` at
   25 264 ms. If I had trusted the picture I would have killed F-1.
4. **"The checker misses surname mentions in *Pride and Prejudice*."** It had
   nothing to miss: the prose I pasted was never saved (that is F-2). I had to go
   back to my own world and construct the A/B there, which is why F-4 half 1 is
   evidenced from *The Ninth Bell* and half 2 from Austen.
5. **"Adding a character to a scene removes them again."** My script clicked the
   suggestion chip for a character who was already cast, and the matching control
   at that point is the remove button on the cast row. Entirely mine.

---

### How to re-run any of this

Driven from a scratch directory, never from `e2e/`. Nothing under `src/` was
edited, nothing was committed. The measurements that matter most are the four
paint timings in F-1 (one script, four conditions), the four save trials in F-2,
and the two halves of F-4 — the missing nudge on a 26-word scene, and the seven
`Mrs …` chips under a paragraph of Austen.
