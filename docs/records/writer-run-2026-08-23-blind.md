# Writer run — 23 August 2026 (blind)

A single morning's work in PlotWeave, driven end to end in a real browser, by
someone with a book in their head and nothing typed. I had not read any prior
review of this app before or during the session.

Screenshots referenced below are in
`/tmp/claude-0/-home-user-PlotWeave/0059390a-1dc2-55c6-9e96-a775864ab3c7/scratchpad/blind/shots/`
(nothing was written inside the repo except this file). The driver scripts are
in the same directory, `s01.mjs` … `s177.mjs`.

---

## What I set out to do

Write *The Salt Road* — a second-world fantasy about Mira Vasse, a courier who
cannot read, carrying a sealed letter of eleven names across a country that is
quietly changing hands. I came to PlotWeave for one reason: **I keep losing
track of who knows what, and who was where.**

Plan for the session: get three chapters in with real prose, two characters, a
couple of places, an item that changes hands, the facts each character knows and
when — then do draft-two work (rename a chapter, move a scene, kill someone,
check continuity, look for a half-remembered line, export the manuscript), then
open a shipped library world and try to use it as my own.

## How far I got

All of it, in about two and a half hours of driving. What exists in the app now:

| | |
|---|---|
| Chapters | 3 (*A Lamp in the Window*, *The Long Reach*, *Andrast*) |
| Scenes | 6 |
| Prose drafted **in the app** | 1,013 words across 4 scenes |
| Characters | 2 (Mira Vasse, Corvin Ashe — Ashe dies in ch. 3) |
| Locations | 4 (Ferrow Crossing, The Reed House, Hallowmere Lock, Marrow House) |
| Items | 2, one of them tracked in a character's hands |
| Relationships | 1 |
| Knowledge facts | 3, with 6 "who learns it, and where" records |
| Manuscript exported | yes, clean Markdown, prose intact |

I also downloaded *The Count of Monte Cristo* from the library (117 chapters, 45
characters) and *The Fellowship of the Ring*, and used the big one for the
questions a small world cannot ask.

Two things stopped me hard enough that I would have lost work without noticing.
One of them was a button the app told me to press.

---

## What stopped me

Ranked by what it costs a working novelist, not by how hard it is to fix.

---

### F1 — The continuity checker's own fix silently deletes the state it says it preserves *(high)*

This is the worst thing I found, because it is damage caused by pressing the
button the app recommends, in the feature whose entire job is protecting
continuity.

**What I did.** In chapter 3, scene *What the housekeeper knew*, I set the
scene's Setting to Ferrow Crossing and put both characters in the cast. At that
moment:

- Mira was carried forward as **alive, at Hallowmere Lock, carrying The sealed
  letter and the Guild tally-stick** (shot `167-mira-before-fix.png` — the
  inventory is listed under a "carried forward" banner).
- Corvin was **dead**, recorded in the previous scene.

The Continuity Checker reported three warnings and offered a bulk fix:
**"Move everyone to the scene 2"** (`166-continuity-before-fix.png`). I clicked
it, as a writer clearing a list would.

**What I expected.** Both characters recorded at Ferrow Crossing in that scene,
and nothing else changed. That is exactly what the code comment promises:

> *"Put them where the scene already says it happens. Everything else about their
> state carries forward from the last record — this writes the one field the
> finding is about, at the one moment it is about, which is what makes it safe to
> apply to a whole ensemble at once."*
> — `src/features/continuity/ContinuityChecker.tsx:426-431`

**What happened.**

1. **Mira's inventory was emptied from that scene onward.** The sealed letter —
   the object the entire book is about — and the tally-stick vanished
   (`169-mira-after-fix.png`). Nothing said so.
2. **Corvin came back to life.** The checker then reported a brand-new warning
   it had just created itself: *"Corvin Ashe is alive again in Ch. 3 after dying
   in Ch. 3"* (`168-after-bulk-fix.png`).

**Evidence in the database.** The snapshot written at that scene
(`sortKey 3.000001`) for both characters:

```
{ c: D2wVyz (Mira),   e: PLMB-m, k: 3.000001, alive: true, inv: 0, loc: Ferrow Crossing }
{ c: 7eRxLy (Corvin), e: PLMB-m, k: 3.000001, alive: true, inv: 0, loc: Ferrow Crossing }
```

Mira's previous best record (`sortKey 2`) has `inv: 2`. Corvin's previous record
(`sortKey 3`) has `alive: false`.

**Mechanism** — `src/features/continuity/ContinuityChecker.tsx:434-448`:

```ts
const prev = await db.characterSnapshots
  .where('characterId').equals(fix.characterId)
  .and((sn) => sn.eventId === fix.eventId).first()
await upsertSnapshot({
  …
  isAlive: prev?.isAlive ?? true,
  inventoryItemIds: prev?.inventoryItemIds ?? [],
  inventoryNotes: prev?.inventoryNotes ?? '',
  statusNotes: prev?.statusNotes ?? '',
  travelModeId: prev?.travelModeId ?? null,
})
```

`prev` is looked for **at that exact scene**. But the finding this fix exists to
clear is *"nothing records where they are in it"* — i.e. the normal case is that
there is no snapshot there, so `prev` is `undefined` every time and the defaults
are written: alive, empty-handed, no notes. The comment's promise ("carries
forward from the last record") is not implemented; there is no lookup of the
last record.

The map's version of the same operation does it correctly — see
`src/features/maps/MapExplorerView.tsx:449-466`, which falls back to
`snapshots.find(…)` where `snapshots` is `useBestSnapshots(...)`, the *resolved
carried-forward* state. The continuity fix has no such fallback.

**Compounding it:** the checker offers **"Move to Ferrow Crossing"** for Corvin
in the same panel where it says *"Dead character Corvin Ashe in 'What the
housekeeper knew'"*. It offers to walk a corpse across town, and taking the
offer revives him.

**Cost.** Undo does recover it — one undo per character, verified
(`171-after-undo1.png`, `172-after-undo2.png`). But the undo label reads
*"Undo: Added character state"*, which says nothing about the letter having been
dropped, and the entire point of a fix-it button is that you stop looking. A
writer who clears eight warnings on an ensemble scene and moves on has silently
emptied eight characters' hands, several chapters deep, and will discover it in
the copy-edit if at all.

---

### F2 — Recording one fact at a scene freezes every other fact there, and earlier edits silently stop at the freeze *(high)*

This is the model showing through, and it is the thing that made me distrust the
app's answers.

**Reproduction (deliberate, from a clean state).**

1. Set the cursor to Ch. 2 · *The Reed House*. Open Corvin → Current State. Type
   "Bread knife" into the new-item box, Enter, **Save State**. The panel shows
   *Inventory: Bread knife*.
2. Press **Next moment** twice, to Ch. 2 · *The seal breaks*.
3. Inventory is **empty** (`161-corvin-knife-lost.png`).

**Why.** A snapshot already existed at *The seal breaks* — written earlier by a
one-click continuity fix — and a `CharacterSnapshot` is a **whole state record**,
not a delta of the field you changed. That record carries `inventoryItemIds: []`,
so it masks anything added at an earlier scene. Location, alive-status, status
notes and travel mode behave the same way.

**I hit this first by accident**, which is how a writer would. Early on I placed
Mira on the map at Ch. 1 · *The Reed House* (before she had any items). Later I
gave her the letter and the tally-stick at Ch. 1 · *The letter arrives*. Two
scenes on, her location was correctly carried forward and her hands were empty:

```
Mira @ "The letter arrives"  sortKey 1        loc Ferrow Crossing  inv [letter, tally]
Mira @ "The Reed House"      sortKey 1.000001 loc The Reed House   inv []
```

The banner on that screen says *"This state is carried forward … nothing has been
recorded here yet"*, which is true of the location and, in the sense that matters
to a writer, false of everything else.

**What this means in practice:** *you must enter facts in story order.* The
single most common draft-two edit — "actually, she's had this since chapter one"
— does not reach the end of the book, and no screen tells you it stopped.

There is a partial guard (`charSnapContentEqual` in
`src/db/hooks/useSnapshots.ts:194`) which declines to write a duplicate when
nothing changed. It does not help here: any snapshot that differs in *one* field
is written in full and pins the rest.

---

### F3 — Ctrl+K cannot find a word you wrote *(med-high)*

**What I did.** Half-remembering a detail — a shutter knocking above a
conversation — I pressed Ctrl+K and typed `shutter`.

**What happened.** *"No results for 'shutter'."* The word appears twice in a
scene draft in this world. Also returning nothing: `towpath`, `wax`, `eleven`.
`eleven` is the fifth word of one of my three knowledge facts.

Controls in the same run: `Ferrow` → 1 result; `Marrow` → 3; `Mercédès` in the
Monte Cristo world → 6 across characters, factions, locations and chapters, in
under a second. So search works; its index is the issue.

**Mechanism.** `src/features/search/SearchPalette.tsx:92-192` queries characters,
items, location markers, chapters, events, timelines, relationships, routes,
regions, lore pages and factions. It never touches `db.sceneTexts` or
`db.knowledgeFacts`. The placeholder is honest — *"Search characters, factions,
locations, lore…"* — but the writer's most frequent lookup is *"where did I write
that line"*, and the app is holding the prose.

**It does exist, elsewhere.** Manuscript → **Find & replace** searched the same
term in 2.1 s and returned *"2 matches in 1 scene"* with a context snippet and a
note that each changed scene is saved as a new version
(`114-find-replace.png`). It is a good tool. Nothing routes you to it; the
global search just says "no results" and lets you conclude the app can't do it.
I only found it by reading `src/features/manuscript/`.

---

### F4 — The @-mention suggestions are unreachable once a scene draft is longer than the screen *(med)*

**What I did.** Typing prose in the scene draft box, I reached the end of a
314-word scene and typed `@Hollow` to name a place, as the placeholder invites
(*"type @ to name a character, item or place"*).

**What happened.** No suggestion list appeared (`173-mention-occluded.png`,
`174-after-scroll.png` — "@Hollow" sits at the bottom of the card and nothing is
below it). The list is in the DOM; it is painted where nobody can click.

**Measured, twice, on two different scenes.** Viewport height 900 px:

| row | top | bottom | what is actually on top at its centre |
|---|---|---|---|
| `new character` | 859 | 873 | the chapter bar (`div: "Ch.2 · The Long Reach"`) |
| `new item` | 887 | 901 | the chapter bar |
| `new place` | 915 | 929 | **nothing — below the viewport** |

Two mouse-wheel scrolls of 400 px changed none of those numbers; the scene card's
scroller reports `scrollHeight − clientHeight = 0`. The first repro, on *The seal
breaks*, gave 855/883/911 with the bar starting at 860 — same shape.

The list opens downward from the caret with no flip-up and no clamping, and the
chapter bar (~60 px, always present on this screen) takes the rest. The row that
is always lost is **`new place`** — the only way to create a location from
inside the writing surface, which matters given F10.

---

### F5 — Creating a place from the draft sets the scene's Setting, but the card denies it until you reload *(med)*

**Reproduced twice.** Typed `@Marrow House` in the draft for Ch. 3 · *Twelve
Marrow Lane*, chose **new place** with a real mouse click at coordinates inside
the viewport (no programmatic scrolling). The database is immediately correct:

```
events:          Twelve Marrow Lane → locationMarkerId zDYnz5BXcfmIxaP2wKNeW
locationMarkers: zDYnz5BXcfmIxaP2wKNeW → "Marrow House"
```

The scene card still offers **`+ Setting`** and shows no SETTING section
(`52-after-realclick.png`). After F5-reload the SETTING section is there, reading
*Marrow House*. Same result earlier for *Hallowmere Lock*.

**Mechanism.** `src/features/timeline/EventCard.tsx:50` holds
`locationMarkerId` in `useState(event.locationMarkerId)`, shadowing the live
query. It is only re-synced in `startEdit` (line 208) and `cancelEdit` (line
153). The `@`-mention handler lives in a child (`SceneDraftSection.tsx:117-126`)
and writes straight to the database, so the card never hears about it.

Not destructive — `saveEdit` (line 142) does write the local value back, but
`startEdit` re-syncs first, so the stale value can't be committed. The cost is
that a writer creates the place a second time, or believes it didn't work.

---

### F6 — "Knowledge Gaps" calls every fact WITHHELD until you happen to set a POV *(med)*

**What I did.** Recorded three facts and who learns them when, then opened the
Writer's Brief at Ch. 2 · *The seal breaks* — both characters present, both
knowing all three.

**What happened.** Three facts, three gaps, all *WITHHELD — "Corvin Ashe, Mira
Vasse know — the reader doesn't yet"* (`93-brief.png`). That is wrong: the scene
is Mira's and the reader is right there.

**What settled it.** I set Point of View = Mira Vasse on that one scene and
reopened the panel. **All three gaps disappeared** (`95-brief-with-pov.png`).

**Mechanism.** `src/lib/knowledgeGaps.ts:59-68` — when a fact has no explicit
`readerLearnsAtEventId`, `readerOrder` walks scenes looking for one with a
`povCharacterId` and returns `Infinity` if none has one. POV is optional, empty
by default, and hidden behind a `+ Point of View` chip on the scene card. So the
default state of a new world produces a 100 % false-positive rate in the panel
the feature is named for. On a book with forty facts, that is forty red herrings
and no clue what caused them.

---

### F7 — Focus mode puts the caret at the top of the draft *(med)*

**What I did.** Opened Focus on *The seal breaks* (309 words already written) and
started typing, as you would to continue a scene.

**What happened.** The text went to the **beginning**: `"ZZZAbove the fourth lock
the river went quiet…"` (`145-focus-caret.png`). Measured on entry:
`{ tag: TEXTAREA, selectionStart: 0, valueLength: 1602 }`. Reproduced a second
time on a shorter scene, where a typed sentence was prepended to the existing
line.

**Mechanism.** `src/features/timeline/FocusMode.tsx:58` calls
`taRef.current?.focus()` with no `setSelectionRange`, so Chromium leaves the
caret at index 0.

The screen is otherwise the best writing surface in the app — 624 px serif column,
18 px/36 px, typewriter scroll, Esc to leave, autosave and a live word count.

---

### F8 — The character History tab is labelled by chapter, so it reads as self-contradictory *(med)*

**What I did.** In *The Count of Monte Cristo*, asked the question I actually came
for: *where was Mercédès when Edmond came back?* Ctrl+K → "Mercédès" → Enter →
History. About seven seconds, two keystrokes and two clicks. Excellent — except:

The list shows **two rows headed "Ch. 5 — The Marriage Feast"** with different
notes, and later **two rows headed "Ch. 92 — The Suicide" with different
locations** — *Monte Cristo's House, Champs-Élysées* and *Morcerf Residence, Rue
du Helder* (`130-history.png`). Read literally, the app is telling me she was in
two places at once.

She wasn't: those are two *scenes* inside one chapter. But
`src/features/characters/tabs/HistoryTab.tsx:78` renders
`` `Ch. ${chapter.number} — ${chapter.title}` `` and never prints the scene
title, although the row already has the event (line 48). The whole snapshot model
keys on scenes; this is the one view whose job is "what changed and when", and it
is the one view that hides which moment each change belongs to.

---

### F9 — The carried-forward banner says "chapter" where the model means "scene" *(med)*

`src/features/characters/tabs/CurrentStateTab.tsx:259-260`:

> *"This state is **carried forward** from an earlier chapter — nothing has been
> recorded here yet. Editing and saving will pin it to this chapter."*

**Reproduced.** I saved Mira's state at Ch. 2 · *Locks at Hallowmere*, stepped one
moment to Ch. 2 · *The seal breaks*, and got the same banner
(`71-same-chapter-banner.png`). The source of the inherited state is the previous
scene **in the same chapter**. And "pin it to this chapter" is wrong in every
case — saving pins it to the scene, which is exactly the distinction that makes
F2 bite.

---

### F10 — A place is a map pin, and the only door for a writer without a map image is labelled "AI" *(med)*

I wanted to record that Mira was at Ferrow Crossing. There is no Locations screen
(`src/router/routes.tsx:76-93` — no such route), and
`CharacterSnapshot.currentLocationMarkerId` points at a `LocationMarker`, which
requires a non-null `mapLayerId` and `x`/`y` (`src/types/map.ts:37-45`). So a
place is a pin, and a pin needs a map.

The Maps screen with nothing on it offers exactly two doors
(`25-maps-empty.png`): **Add Map**, whose Upload button stays disabled until you
supply an image or a URL (`26-upload-map-dialog.png`), and **Generate locations
with AI**.

**I nearly filed this as "impossible without a map image", and I was wrong** —
so, precisely: the AI dialog is not an API-key feature. It is copy-a-prompt /
paste-JSON, and I drove it by hand with two lines of JSON in a fresh world. It
created a blank grid layer called *Locations* with both pins on it
(`177-ai-locations-created.png`). After that, `+ Location` works normally.

So the finding is not "you can't", it is: **the only door is behind a button
labelled AI, needs hand-written JSON to use without one, and nothing connects the
need to the door.** Meanwhile the consequence is silent: with no map, the scene
card's `+ Setting` row is simply not rendered (`AddEventDialog.tsx:159`,
`SceneDraftSection.tsx:116` — both deliberate, both unexplained on screen). A
writer working from a mapless second world sees an app that never offers to
record a setting and never says why.

---

### F11 — The item's own page says nothing about who has it or where it's been *(low-med)*

The Items screen promises *"Objects characters carry, use, or lose over time."*
Opening **The sealed letter** gives its name, its description, an image slot, an
empty "No lore linked" panel, and nothing else (`57-item-detail.png`).
`src/features/items/ItemDetailView.tsx` is 353 lines: header, edit form, related
lore, cross-timeline artifacts. No custody, no location, no history.

To say who is holding it you go to the *character's* Current State and add it to
their inventory. The **roster** row does show the current holder at the cursor —
*"carried by Mira Vasse · The Reed House"* (`149-items-roster.png`) — so the fact
is computed; it just isn't on the item. And the item's *chain of custody over
time*, which is the thing you open an item's page to check, exists nowhere: the
data is in `CharacterSnapshot.inventoryItemIds` and `ItemPlacement`, and no view
renders it as a sequence.

---

### F12 — Moving a scene between chapters is drag-and-drop only *(low)*

On the Timeline, the last scene in a chapter has **"Move later" permanently
disabled** — Playwright's log for that click: *"element is not enabled"*, retried
for 30 s. The only way across a chapter boundary is dragging a card on the
**Corkboard** (`src/features/corkboard/CorkboardView.tsx:41`, `179-184`), which
is discoverable (the screen says so at the top) but has no keyboard equivalent.
Nothing on the Timeline hints that the Corkboard can do what its own arrow
cannot.

**Credit where due:** the drag itself was clean, and it did the hard part right —
moving *The Reed House* from ch. 1 to ch. 2 recomputed the snapshot sort keys
from `1.000001` to `1.999999`, keeping global order correct.

---

### F13 — You cannot jump to a chapter by its number *(low)*

In a 117-chapter book, `74` and `Chapter 74` both return *"No results"*.
`SearchPalette.tsx:143` matches `ch.title` and `ch.synopsis`; `ch.number` is
printed in the result label but never searched. The alternative is the chapter
bar, which for that world is **6,500 px of 47–64 px segments in a 1,066 px
strip** — roughly six screen-widths of horizontal scrolling.

---

### F14 — The Arc grid clips text while most of the screen is empty, and can't be typed into *(low)*

Measured on my 3-chapter world at 1440 px: the table is **512 px wide inside a
1440 px main**, and every location string is clipped — "Hallowmere Lock" needs
85 px in a 79 px box, "A Lamp in the Window" 112 px in 93 px
(`147-arc.png`). `src/features/arc/CharacterArcView.tsx:382` sets
`colWidth = 100 | 110` and applies it as **both** `minWidth` and `maxWidth`, so
columns never take the 928 px going spare.

This is a real trade-off — the fixed width is right for the 117-chapter case —
but it is applied unconditionally.

The grid is also **read-only** (*"Click a column to set cursor · Click a notes
cell to expand"*). It is the natural surface for entering per-scene state in
bulk, laid out exactly as the bookkeeping is shaped, and you cannot fill a cell
in it. Everything must go through Characters → person → Current State → Save,
one person and one scene at a time.

---

### F15 — Character States truncates the name to make room for a caption *(low)*

In the chapter-detail Character States panel, a character with no recorded state
at that scene renders as **"Corvin …"** / **"Mira Va…"** — measured at a 57 px
box holding 72 px of text, in a 296 px column, because the italic *"in the scene,
no state recorded"* takes priority (`100-corvin-in-final.png`, `147`). The name
is the part you are scanning for.

That row is also inert: it tells you a state is missing and gives you no way to
record it. Filling the gap it names costs six to eight clicks across three
screens (move the cursor → Characters → the person → Current State → set → Save).

---

### F16 — The custom select has no combobox semantics anywhere in the app *(low)*

`src/components/ui/select.tsx` gives the trigger a bare `<button>` — no
`role="combobox"`, no `aria-expanded`, no `aria-haspopup`, no `aria-controls`
(the only ARIA in the file is `role="listbox"` at line 164 and
`role="option"`/`aria-selected` at 200-201). The `Label` components render with
`for: null`, so nothing associates them either.

Verified live in the New Relationship dialog: two adjacent selects, both with the
accessible name **"Select…"**, both indistinguishable from a plain button. A
screen-reader user is told "Select…, button" twice and given no indication that
either opens a list, or which is Character A. This applies to every select in the
app.

---

## What I only suspect

Kept separate on purpose. None of these is reproduced; each says what would
settle it.

- **"Snapshot coverage 83 %" on the dashboard reads as a target.** It links to
  the Arc grid and prints "5 / 6 scenes". I suspect it will drive writers to
  record state they do not need, purely to clear the number — the app's own
  model says a snapshot should exist only where something *changed*, so 100 %
  coverage is not a goal, it is a symptom. **Settled by:** asking two or three
  users what they think the number is asking them to do, and whether they filled
  scenes in to raise it.

- **Onboarding step 3 may be a step with no decision in it.** "Where does their
  story begin?" presented a single-option dropdown — the scene step 1 had just
  made. `src/features/onboarding/steps/StepPlace.tsx` builds the list from
  `useWorldEvents`, and after step 1 that is exactly one event, so I believe it
  is *always* one option in the normal path. I did not test the
  skip-step-1-then-come-back path. **Settled by:** running the wizard with step 1
  skipped and seeing whether the list is ever longer than one.

- **Cross-chapter scene moves may be impossible on a touch device.** The
  corkboard uses HTML5 `draggable`/`onDragStart` (`CorkboardView.tsx:41`), which
  historically does not fire from touch without a shim, and I found no keyboard
  alternative (F12). I did not test on touch. **Settled by:** driving the
  corkboard with Playwright's touch emulation, or finding the pointer/touch shim
  if one exists.

- **The Reading-mode default on library downloads may be wrong for the "use it
  as a reference" case.** Downloading *Fellowship* dropped me straight into a
  spoiler-gated world with *"Editing is put away while you read"*, 41 characters
  and 106 places hidden. That is clearly right for reading along, and clearly
  wrong for the use the library page also advertises ("to explore how PlotWeave
  fits together"). Turning it off took 2 clicks and a screen change, so the cost
  is small. I do not know which use is more common. **Settled by:** counting how
  often downloaded worlds have reading mode turned off within the first session.

- **The dashboard's "1 alive / 1 dead" tile may not follow the time cursor.** I
  saw it with the cursor at ch. 3, where it was correct, and did not check it at
  ch. 1. **Settled by:** moving the cursor to the first scene and re-reading the
  tile.

---

## What worked

Honestly, and not as a courtesy — several of these are the reason I would keep
using it despite F1.

- **The Writer's Brief is the best thing in the app.** One click, 1.7 s on a
  117-chapter world and 2.1 s on mine, and it answers the whole question I came
  with: which scene, its setting, who is here, where each of them is, what each
  is carrying, what everyone in the room knows, and what the reader doesn't yet
  (`93-brief.png`, `131-brief-big.png`). On the big world it adds the in-world
  date, POV, each character's want, and their faction. That panel alone justifies
  the bookkeeping — where the bookkeeping is right.

- **The knowledge model does the thing.** Counts respect the cursor: my three
  facts read *known by 0 / 2* at the opening scene and *2 / 2* after the scene
  where they learn them (`79-knowledge-at-scene1.png` vs `78-three-facts.png`).
  Six "who learns it, and when" records took about 13 s of clicking. This is the
  reason I came, and it delivers.

- **The continuity checker is fast and finds real errors.** 275 ms across 117
  chapters, 45 characters, 91 scenes. On my world it caught both errors I
  planted — a character in a scene but recorded somewhere else, and a dead man in
  a later scene — with the right chapter numbers and a sane explanation. Its
  *detection* is excellent. It is only the fix button that is dangerous (F1).

- **Character History is the "where was she" answer.** Ctrl+K → name → Enter →
  History, about seven seconds, and you get chapter, place, travel mode and a
  line of what she did, in order (`130-history.png`). Fix F8 and this is a
  reference tool worth the price on its own.

- **Prose is treated as prose.** The draft box auto-grows, auto-saves, counts
  words and paragraphs, and keeps versions with a real diff and a Restore
  (`140-scene-history.png`). Focus mode is a genuine writing surface. The
  Manuscript screen renders the stitched book in a readable serif column
  (`113-manuscript.png`), and **Download .md** produced 5,320 bytes of clean
  Markdown with my prose untouched. Find & replace saves each changed scene as a
  new version and says so.

- **"In the text but not on this scene."** After pasting a scene, the card
  offered *Mira Vasse* and *Corvin Ashe* as one-click chips because their names
  appear in the prose (`21-scene2-prose.png`). One click each, and the cast was
  right. That is the correct shape for every piece of bookkeeping in this app:
  read what I wrote, offer the record, let me confirm.

- **`@`-mention creation handles multi-word names.** I assumed it would break at
  the space and it does not: typing `@Corvin Ashe` kept offering *Corvin Ashe —
  new character* (`19b-corvin-ashe.png`). Good thing I checked before writing it
  up.

- **Cross-chapter scene moves keep the model consistent.** Dragging a scene from
  ch. 1 to ch. 2 recomputed its snapshots' sort keys correctly.

- **The library is fast and honest.** A 703 KB world went from click to a painted
  dashboard in **2.7 s** (207 ms to navigation). Each card states its counts and
  carries a clear "unofficial, fan-made, no text from the book" notice.

- **Coming back works.** After a full reload the world card showed *3 chapters,
  2 characters*; opening it restored the time cursor exactly where I left it and
  greeted me with *Recently edited* — five scenes, each with its chapter and how
  long ago (`118-dashboard.png`). That is the right landing pad for a second
  morning.

- **Undo is real.** Deleted a scene, undid it in 2 s, everything back
  (`135-after-undo.png`). The toolbar button carries the specific action in its
  tooltip.

---

## Verdict

**PlotWeave genuinely helps a novelist — but not the novelist it currently asks
to do the most work, and not yet at a level of reliability that lets you trust it
without checking.**

The honest test of a story bible is whether the bookkeeping pays for itself.
Here it does, twice over, in exactly two places: **who knows what, when**, and
**who was where**. The Writer's Brief answers both in one panel in under two
seconds, at any moment in the book, with the letter in the right hands and the
right secrets in the room. Nothing I have used answers that question that well.
For a book where those questions are load-bearing — a mystery, a conspiracy, an
ensemble fantasy, a multi-POV thriller, anything where a reveal has to land in a
specific order — that panel is worth the price of admission, and the continuity
checker's 275 ms sweep over a 117-chapter book is worth it again.

Against that, three things are true and none of them is cosmetic.

**First, the app can lose your work while telling you it is protecting it.** F1
is not a rough edge; it is a recommended button, offered in bulk, that empties
characters' hands and revives the dead, under a code comment asserting it does
neither. The continuity checker is the feature you turn to precisely when you
have stopped trusting your own memory of the draft. If that feature can quietly
corrupt state, then every answer the app gives you afterwards has to be verified
by hand, and an unverifiable reference tool is worse than a notebook, because a
notebook does not sound confident.

**Second, the model demands that you write your notes in story order.** F2 means
the most natural draft-two edit — going back and adding a fact you have just
decided was always true — stops dead at the next scene where you happened to
record anything at all, with no warning. That is a serious mismatch with how
revision actually works. A story bible earns its keep on draft two and three;
this one is easiest to keep correct on draft one, when you need it least.

**Third, the bookkeeping is priced per scene per character and paid in clicks.**
Recording one character's state at one scene is six to eight clicks across three
screens. The one surface laid out exactly like the work — the Arc grid, a
character × scene matrix — is read-only. The panel that tells you a state is
missing (F15) is inert. Getting from a cold start to the first word of prose took
ten clicks. None of these is outrageous alone; together they mean the app asks
for a habit rather than a moment, and habits are what writers drop first.

So: **who does it help?**

- **It helps most, and starting around 40,000 words**, the writer of a
  multi-thread, multi-POV, secret-heavy book with a large cast, who is on draft
  two or later and has already been bitten once by a continuity error. That
  writer already keeps this information somewhere. PlotWeave keeps it better,
  answers questions the notebook can't, and the Writer's Brief pays back the
  entry cost within a chapter or two. That writer should use it — and should
  export a `.pwk` before touching the continuity checker's fix buttons.

- **It helps the writer of a long, place-heavy series**, where the map is a real
  artefact and journeys matter. The map, travel modes and journey trails are
  built for that book and nothing else does it as well.

- **It does not help, and is more work than it is worth, for the writer of a
  short, single-POV, one-location, character-light book.** Two people in a house
  over one weekend does not need a snapshot model; it needs a text file. The app
  will ask for a map before it will let that writer say where anyone is, and give
  nothing back for it.

- **It does not currently help the pantser mid-flow**, and this is the sharpest
  regret. The writing surface is good — the auto-growing draft, the versions,
  Focus mode — but the moment you use it as an actual notebook, the app pushes
  back: Focus mode types into the top of your draft (F7), the `@`-mention list
  you were promised is painted under the chapter bar (F4), and when you go
  looking for the line you half-remember, Ctrl+K says it isn't there (F3). Those
  three together are the difference between a tool you write in and a tool you
  file in.

- **It does not help a screen-reader user** to the standard the rest of the app
  sets (F16).

**What it depends on**, stated plainly: it depends on whether your book's
difficulty is *bookkeeping* difficulty. If what makes your novel hard is holding
forty facts in the right order across sixty scenes, this app is a real
instrument and I would keep using it. If what makes your novel hard is the
sentences, PlotWeave will hand you a second job and a percentage-complete meter
to feel bad about.

And one thing it does not depend on: **F1 should be fixed before anyone is
encouraged to rely on the continuity checker.** A tool for keeping a story
straight must not be the thing that bends it. Everything else in this report is a
cost; that one is a risk.
