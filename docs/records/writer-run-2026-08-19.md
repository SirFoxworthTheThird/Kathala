# A morning in PlotWeave — writer run, 19 Aug 2026

Third writer's-eye session. Everything below happened in the app built from
`6e2ac29` (`npm run build`, served by `vite preview`) and driven with Playwright,
at 1440×900 unless a phone width is named.

The brief was blunt: **is this app useful to a working novelist, or is it
cumbersome?** So this run is a morning's work rather than a tour — make a world
from scratch, get three chapters and four scenes of prose in, put two characters
on a map, move them between scenes, record a secret and ask who knew by chapter
2, come back cold, then download *The Name of the Wind* and work in that.

None of W-1..W-13 / WRUN-1..WRUN-14 / F-1..F-7 is re-filed. Where a finding is
the same *shape* as an existing one on a different screen, it says so.

---

## Short answer to the blunt question

**Useful, with two specific places where it stops being.** The core loop — write
prose in the scene card, have the app notice who you named, ask "who knew by
then", come back tomorrow — works, and works better than a notebook. Undo names
the operation and survives a reload. The Knowledge panel answered a real question
in one click. The Manuscript in the Paper theme is the nicest place I've written
in a browser this year.

What makes it cumbersome is a seam: **the app's headline promise ("who was
where") is gated on cartography and on hand-maintained per-scene cast**, and the
two affordances built to close that gap — the `@` picker and tap-to-place — both
fail on the most ordinary input a fantasy writer has. Two-word names. A room two
people are standing in.

---

## What stopped me

### W19-1 · high · Placing a second character where the first one stands does nothing, and says nothing

**What I did.** Cursor on Ch.2 · *The flats at low water*. Sidebar → **Place
Ysolde Vane on the map**. The app puts up a hint: *"Tap a location to place
Ysolde Vane."* I tapped the middle of the **The Flats** pin — where Maren Vane
already was.

**What I expected.** Ysolde at The Flats.

**What happened.** Ysolde stayed at The Ledger Room. **Maren Vane's detail panel
opened instead**, covering the hint that still said "Tap a location to place
Ysolde Vane". Nothing said the placement had failed.

**Measured geometry**, same run, DOM rects at 1440×900:

| element | box | z-index |
|---|---|---|
| Maren's character pin | x 588–726, y 746–773 | 1712 |
| *The Flats* location pin | x 587–706, y 743–777 | 612 |

The character pin covers the location pin except for a ~3px strip. Clicking
`(640, 744)` — inside that strip — **did** place her. So the control works; it is
just almost entirely covered.

**Mechanism.** `src/features/maps/LeafletMapCanvas.tsx:1216`:

```tsx
zIndexOffset={isDraggingCharacter ? 2000 : -100}
```

Location markers are raised above character pins *only during a drag*.
Tap-to-place (`placingCharacterId`) doesn't set that flag, so markers stay at
-100 under character pins at 1000. And `handleCharacterClick`
(`MapExplorerView.tsx:409`) doesn't check `placingCharacterId`, so the tap gets
eaten selecting the character underneath.

**Why it's the top finding.** Two people in one room is the normal case, not the
edge case. And the drag workaround is HTML5 drag-and-drop on a sidebar row — **it
does not exist on touch**, where `onPlace` even does `setSidebarOpen(false)` to
make room for the tap. On a phone this has no workaround at all.

Not covered by MAP-2, MW-5, MW-6 or MW-8, which are all about other overlaps.

---

### W19-2 · high · The `@` picker cannot name anything with a space, a hyphen or an apostrophe

**What I did.** In the scene draft I typed `The tide bell rang two hours early,
and every ledger clerk in Salt Gate knew what that meant. @Ysolde` — the picker
opened correctly, offering *Ysolde · new character* and *Ysolde · new item*. I
carried on typing the surname: ` Vane`.

**What happened.** The picker closed at the space. The prose was left reading
**`… what that meant. @Ysolde Vane`** — a literal `@` in my manuscript, no
character created, no mention recorded, no message.

Probed the same field again: `@Barrow-wight` → **0 picker rows**. `@O` → 3 rows.
So a hyphen kills it too, as does an apostrophe.

**Mechanism.** `src/features/timeline/SceneDraftEditor.tsx:38-39`:

```ts
const m = before.match(/@(\w*)$/)
```

The token can only be a single `\w+` run. `src/lib/mentionPicker.ts` is fine — it
already matches *any word* of a candidate name and inserts the full name — so
this is purely the editor's token.

**Measured cost.** Across the 25 shipped `.pwk` books: **516 of 760 character
names (68%) are not a single `\w` token** — *Ysolde Vane*, *Barrow-wight*,
*Durin's Bane*, *Renée de Saint-Méran*, *The Road-Mender*. Picking an *existing*
two-word character works (typing `@Yso` finds *Ysolde Vane* and inserts it
cleanly — that half is good). What's impossible is the thing the picker was built
for: **creating a record without leaving the prose**. For most fantasy names you
must abandon the sentence, go to Characters, add them, come back.

Related but different: **F-4** (writer run 17 Aug) was `manuscript.ts` keying on
the first word — a different file, already fixed. This is new.

---

### W19-3 · med-high · You cannot write down a place until you have a map picture

**What I did.** Brand-new world, three chapters. I wanted to say the first scene
happens in *The Ledger Room*.

**What happened.** There is no Locations screen. There is no `+ Location` chip on
a scene. The `@` picker offers *new character* and *new item* and no *new place*.
Maps says *"No maps yet — Upload an image of your world…"*, and Add Map requires
a file or a URL.

**Mechanisms**, all three consistent and deliberate:

- `SceneDraftSection.tsx:213` — `canCreateLocation={mapLayers.length > 0}`
- `EventCard.tsx:103` — `{ id: 'location', available: locationMarkers.length > 0 }`
- `CurrentStateTab.tsx:31` — the character's Current Location select is populated
  from `useLocationMarkers(firstMapId)`

**The consequence I actually hit.** "Where was she when he found the letter?" —
the app's single best reason to exist — was unanswerable until I had a map. The
only route that doesn't want artwork is **Generate locations with AI**: paste
JSON from a chatbot, and `sectionImport.ts` draws a grey grid PNG and lays your
places on it. That worked (I used it), but a writer with a notebook full of place
names and no AI subscription and no map has nowhere to put them.

`CAL-2` decided the *opposite* way for Calendar ("the remedy would have hidden
the feature").

---

### W19-4 · med · The Writer's Brief never says where the scene happens

**What I did.** Set *A letter under the door* to **Location: The Ledger Room**
and put Ysolde in its cast (her recorded state is The Flats). Opened the Writer's
Brief on that moment.

**What happened.** The brief says:

```
ACTIVE SCENE
A letter under the door
Maren finds the letter and does not open it.
CHARACTERS 2
  Maren Vane   carried forward   The Ledger Room
  Ysolde Vane  carried forward   The Flats
```

The scene's own declared location is **not shown anywhere**, and nothing notices
that a scene set in The Ledger Room has a cast member recorded at The Flats.
Continuity Checker: silent.

**Mechanism.** `WritersBriefPanel.tsx:310-335` renders title, in-world day,
description and POV from `activeEvent` — never `activeEvent.locationMarkerId`.
The panel already builds `markerById` (line 168, used for character snapshots),
so the lookup is sitting there.

**Confirmed on a shipped book:** in *The Name of the Wind*, all 149 events carry
a `locationMarkerId` (`loc-waystone-inn`, `loc-edema-road`…), and the brief for
Ch.0 still shows *Waystone Inn* only as Kvothe's snapshot location, never as the
scene's setting.

Cost: I recorded the fact and then couldn't read it back on the screen whose
whole job is briefing me on the moment.

---

### W19-5 · med · The book I wrote this morning is listed below the book I downloaded once

**What I did.** Closed the browser after a morning's work, reopened
`http://localhost:4173/`.

**What happened.** *The Name of the Wind* — downloaded from the Library, read for
ten minutes — sits **above** *The Salt Gate*, which I made and filled today. Its
card reads **"Created Apr 15, 2024"**. Mine reads "Created Aug 19, 2026". Neither
card says when I last touched it or how many words are in it.

**Mechanism.** `useWorlds()` is `db.worlds.orderBy('createdAt')`
(`src/db/hooks/useWorlds.ts:7`) — **oldest first**. `WorldCard.tsx:94` prints
`Created {formatCreated(world.createdAt)}`, with a comment explaining that it is
deliberately the creation date.

`WorldSelectorView.tsx:262-275` has a *two-shelf* design that would have
prevented this ("Your own work leads, because this is a writing tool") — but the
shelves split on `readingMode`, and the app itself tells you to turn reading mode
off to edit a library book. The moment you do, it becomes a "draft" and its
fixture `createdAt` outranks everything you own. **All 25 library `.pwk` files
carry a past `createdAt`** (2024-04-15 to 2026-08-16), so this happens with any
of them.

The created date is arguably the wrong fact to print on the card a returning
writer sees a hundred times, and `world.updatedAt` already exists — the
dashboard's Recently-edited list sorts on it.

---

### W19-6 · med · 128 of 161 continuity warnings in a shipped book say `POV "?" is not in the cast`

**What I did.** Opened the Continuity Checker in *The Name of the Wind* (reading
mode off, as a writer would).

**What happened.** *161 warnings*. Section counts: CHARACTERS 7, ITEMS 5,
FACTIONS 5, **POV 130**. Of the POV rows, **128 read verbatim:**

```
POV "?" is not in the cast of "A Silence of Three Parts"
Ch. 0 — add them to Characters or clear the POV
```

The `"?"` is an unresolved id. Counting the fixture: 128 of that book's 149
events carry a `povCharacterId` (`30000000-0000-4000-a000-000000000001`) that is
**not in its characters table**. That part is fixture data and out of scope — but
three app behaviours are not:

1. The checker reports the **wrong fault**. It isn't "not in the cast", it's
   "this id names no character", and the remedy it offers — *add them to
   Characters* — is impossible, because "them" doesn't exist. There is no
   dangling-POV check.
2. The Writer's Brief prints **`The reader knows — — doesn't.`** on those scenes:
   `nameOf = charById.get(id)?.name ?? '—'` (`WritersBriefPanel.tsx:570`) drops
   an em-dash into a sentence that already contains one.
3. The Brief's POV line silently vanishes for the same id — two different
   fallbacks for one condition.

Net effect: 80% of the panel is one unactionable row repeated, burying the 33
real warnings. That is `CC-2`/`CC-3`'s shape on a different book. The checker
itself is fast — **150–191 ms** to render the count, measured twice.

---

### W19-7 · low-med · The continuity warning that knows the fix doesn't offer it

`prose-untagged` — *"Maren Vane is named in the prose but not in the cast of 'A
letter under the door'"* — carries `characterId` and `eventId` and no `fix`. Only
two kinds do: `char-before-intro` and `travel-dist` (`computeIssues.ts:358,
828`). Each row offers suppress (eye) and navigate (chevron), and the chevron
lands you on the **chapter** with every scene card collapsed.

This is `HB-1a` ("the warning knew everything the fix needed and still sent you
away") in the one check a drafting writer meets constantly — I generated five of
them by writing 143 words.

**Mitigating, and it's good:** the scene editor already has the fix. Expanding a
scene shows a dashed chip *"In the text but not on this scene: + Maren Vane"*,
`title="Maren Vane appears 1× — click to add to this scene"`, one click. It works
on a phone too. The two screens just disagree about whether the fix is one click
or four.

---

### W19-8 · low · One AI-generated place in three loses its name, and it's the one you have to click

I pasted four places (*Salt Gate* + three children). On the Salt Gate sub-map,
**three markers, two labels**. *The Ledger Room* rendered as a **14×14 dot with
empty text** while *The Flats* and *The Tide Bell* kept their pills — on a
1600×1000 canvas that is otherwise empty. Then W19-3 forced me to click that
nameless dot to place a character in it.

**Mechanism.** `sectionImport.ts:1078` lays markers on a fixed **6-column** grid:
`cw = (1600 − 320)/5 = 256` map px. `labelDeclutter.ts` estimates a pill at
`max(88, len*8 + 16) + 28 + …` px. At the default fit zoom a 15-character name
overruns its 256px column and the declutterer — correctly — drops it. The
declutter is right; the layout spacing is what's too tight for the names it's
placing.

---

### W19-9 · low · The draft placeholder offers something the world can't do

`SceneDraftSection.tsx:215`: *"Write or paste this scene's prose… (type @ to name
a character, item **or place**…)"* — unconditional, while `canCreateLocation` is
`mapLayers.length > 0` two lines above. In every brand-new world the prompt names
a third option that isn't in the list, with no explanation.

---

### W19-10 · low · Paper's only contrast failure is a colour baked into your data

Swept every leaf text node on `/manuscript`, `/timeline`, `/dashboard` and
`/characters` in the **Paper** theme, computing WCAG ratio against the first
opaque ancestor background. **One failure on all four screens**, the same one:

`rgb(99,102,241)` on `rgb(242,239,233)`, **12.16 px, ratio 3.89** (needs 4.5) —
the active scene title in the chapter bar. That indigo isn't a theme token; it's
the timeline's stored `color`, hardcoded as `#6366f1` by the first-run wizard
(`StepTimeline.tsx:45`, also `worldSpec.ts:212`, `sequel.ts:140`). Paper defines
its own `--tl-accent: hsl(214 58% 44%)`, which would have been fine — the data
overrides it.

One sub-AA node across four screens is a good result for a new light theme; it's
worth fixing precisely because it's the only one.

---

## What I only suspect

Kept separate — these could not be settled in the time available.

- **The Manuscript is read-only, and that may be the wrong call.** Clicking a
  paragraph does nothing (`0` textareas, `0` contenteditable, `activeElement`
  stays `BODY`). It is the screen where you *find* the typo. There is a route
  back — each scene caption is a `<button title="Open in timeline">` — but it's
  styled as an 11px grey caption with only a `hover:text-foreground` change,
  which is `X-7`'s pattern. **What would settle it:** whether writers reach for
  the Manuscript to read or to revise. This run had 152 words; the question needs
  someone with 80,000.
- **The nav rail ships collapsed and icon-only**, expanding on hover, with
  `title` tooltips (`NavRail.tsx`). That is not what `X-3` decided ("Labels
  always visible"). In use it never cost anything — the hover expansion is
  instant. **What would settle it:** a first-run user who doesn't know to hover.
- **Search may double-count in one-scene-per-chapter worlds.** `Chandrian` in
  *The Name of the Wind* returned 27 results including a CHAPTERS group and a
  SCENES group whose top five rows carried identical titles and identical
  summaries. **What would settle it:** counting title-identical chapter/scene
  pairs across the library.
- **The phone map letterboxes against the page background.** At 390×844 in Paper
  the grid image is a dark band with light above and below, which reads as a
  rendering fault rather than as "the map is this shape". Invisible in dark
  themes. Not checked with real map art.
- **Export names the file after the timeline, not the book.** *The Salt Gate*
  exported as `the-drowning-year.md`. Content was perfect. Whether that's wrong
  depends on whether a world is a book or a series.

---

## Five things that looked like findings and were not

Listed because each one would have been a plausible-sounding report.

1. **"Next moment is disabled with three chapters ahead."** It wasn't — creating
   a scene moves the cursor to it, so the run was already on the last moment.
   Walked all four moments forward and back afterwards: correct in both
   directions.
2. **"The cast picker in Add Scene is unclickable after you fill Description."**
   The locator was matching the *Character States* empty-state paragraph behind
   the modal. The button is fine.
3. **"A character can be added to a scene's cast twice."** The screen text read
   `CHARACTERS / Ysolde Vane / Ysolde Vane`; the record has
   `involvedCharacterIds: ['mdVBZ…']` once. An `innerText` artefact of the remove
   button.
4. **"The Continuity Checker takes 6 seconds on a 94-chapter book."** That was a
   `waitForTimeout(6000)` in the driving script. Measured properly: **191 ms and
   150 ms**.
5. **"Character snapshots are per chapter, so the app can't tell two scenes
   apart."** They're keyed by `eventId`, per scene. `CLAUDE.md`'s snapshot
   section says chapter; the code and the data say scene.

---

## What worked

These are the reasons to keep it open, and it would be a shame to trade any of
them away.

- **Undo survives a reload and names what it will undo.** `Undo: Added chapter
  "Scratch chapter to undo" (Ctrl+Z)` before *and after* a full page reload;
  Ctrl+Z put the world back. When it *is* disabled the tooltip explains why
  ("importing or generating starts a fresh history") rather than looking broken.
- **Prose vs. record is the feature that earns the product.** Three scenes
  written without touching the cast; the checker found all five omissions, named
  the character, named the scene, and counted the appearances. The in-editor chip
  fixes each in one click. This is the app inferring what it can rather than
  making you maintain it.
- **"Who knew by then" is a one-click answer.** Knowledge shows `known by 1 / 2`
  at the cursor, and the Brief's *Knowledge in the room* names Maren and not
  Ysolde at Ch.2. Both `Character…` and `Learns it at…` pickers list scenes in
  story order.
- **Coming back is well handled.** Two clicks from a cold browser to the scene
  being written: *Recently edited* with relative times ("11m ago"), plus Writing
  Progress (152 total, +152 today, 1 day streak). Reloading mid-wizard replaces
  the wizard with a next-steps checklist rather than losing your place.
- **The Paper theme on the Manuscript is the best writing surface in the app.**
  Serif `--font-prose`, sane measure, `* * *` scene breaks, per-chapter word
  goals inline. The prose font reaches into the scene textarea on a phone too.
  This is decoration that helps.
- **Volume is fine.** *The Name of the Wind*: 94 chapters, 56 characters, 149
  events. Library download to a rendered world in ~0.5 s to the route change.
  Timeline first chapter row in **396 ms**. Arc grid, 56 × 94, **1.74 s and
  1.76 s** on repeat in-app navigation, with inherited cells correctly dimmed.
  Continuity in **~170 ms**.
- **Reading mode is honest about the trade.** "Turn it off whenever you want to
  edit. If this world came from the library, note that downloading it again
  restores the original and discards your changes — export it first."
- **Controls are named.** Every button on the timeline, chapter detail and map
  sidebar was dumped and none was an unnamed icon button; the map sidebar even
  splits *On the map (1)* / *Not placed (1)*. `WRUN-6`, `MW-3` and `HB-2a` are
  holding up in use.
- **Export is clean.** Five formats, a live word/scene count before you commit,
  and the `.md` came out with the prose intact and `* * *` between scenes.

---

## Ranked, by what it costs a writer

1. **W19-1** — silent placement failure onto an occupied pin; no workaround on touch.
2. **W19-2** — `@` can't create a two-word name; 68% of shipped names; leaves `@` in the prose.
3. **W19-3** — no place record without a map; "where was she" gated on cartography.
4. **W19-4** — the Brief omits the scene's own location; nothing checks it against the cast.
5. **W19-5** — the selector buries your book under a library download.
6. **W19-6** — `POV "?"` ×128 makes the checker look broken on a flagship example.
7. **W19-7** — the prose/cast warning has no fix button although the editor's chip does.
8. **W19-8** — one auto-laid-out pin in three has no name.
9. **W19-9** — placeholder promises "@ … or place" in a world that has none.
10. **W19-10** — `#6366f1` is Paper's only sub-AA text.
