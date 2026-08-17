# A morning's work in PlotWeave — writer run, 16 Aug 2026

A novelist's session, not a test pass. Three chapters of a second-world fantasy
already drafted on paper; the reason for trying PlotWeave is that I keep losing
track of who was where and who knew what. Everything below happened in the app
built from `75b5531` with a plain `npm run build`, served by `vite preview` and
driven with Playwright from a scratch directory at 1440×900.

---

## What I set out to do, and how far I got

1. **Start from nothing.** Made a world, *The Salt Between Us*; ran the first-run
   guide; three chapters, six scenes, three characters; a map with four places;
   located two characters scene by scene; recorded one secret and who learns it
   and when. Done.
2. **Come back to it.** Reloaded repeatedly through the session and closed the
   browser between chunks. The cursor, the world and the work were always
   where I left them. Done, and it worked.
3. **Ask a real question.** *"Where was Ysolde when Rhun found the letter, and
   who else knew by then?"* — answered in **two clicks and 2.6 s** by the
   Writer's Brief, which is the best thing in the app. Done.
4. **Bring in real material.** Imported *Dracula* from the Library (25
   characters, 27 chapters, 84 events) and used it as if it were mine. Done.

I got the morning's work done. The app stopped me eight or nine times; twice
seriously enough that I would not trust what it recorded.

**Where the report puts numbers, I measured them.** Where I am guessing, it says
so, in its own section. Five things I thought I had found turned out to be
wrong when I checked; they are listed too, because a review that only shows its
hits is not showing its method.

---

## What stopped me

Ranked by what it costs a writer, not by how hard it is to fix.

---

### W-1 · high · ~~The character panel writes a status note I never typed~~ — **fixed**

**What I did.** Map screen. Time cursor on *Ch.3 — Rhun finds the letter*.
Opened Rhun Aldemar's panel from the map sidebar and typed into **Status**:
`FINAL: he decides not to burn it.` Then clicked **Next moment** in the top bar
to go to the next scene, *Ysolde lies to the harbourmaster* — same chapter,
Rhun has no record of his own there, so the panel shows his carried-forward
state. Clicked into the Status box, thought better of it, clicked away.

**What I expected.** Either my sentence carried forward, or the box was empty.

**What happened.** The box showed **a different sentence** — the one that
record held *before* my edit. Clicking away wrote it to the new scene. The
world now stores, for *Ysolde lies to the harbourmaster*, a status note that I
never typed and never saw as current:

```
at                                  status
'Rhun finds the letter'             'FINAL: he decides not to burn it.'
'Ysolde lies to the harbourmaster'  'Trial 2: reading the letter by lamplight.'
```

**Evidence that it is deterministic, not a flake.** Two consecutive trials in
one session, typing a distinct sentence each time and stepping forward:

```
trial 1 — at scene B, field shows: "Reading the letter by lamplight. Decides not to burn it."
   back at A, field shows:         "Trial 1: reading the letter by lamplight."
trial 2 — at scene B, field shows: "Trial 1: reading the letter by lamplight."
   back at A, field shows:         "Trial 2: reading the letter by lamplight."
```

The field is exactly **one edit behind** after a cursor step, every time.

**Evidence it is the step and not the data.** Arriving at the same scene by a
*fresh mount* — set the cursor, reload the page, open Maps, open the panel —
shows the correct carried value:

> `FRESH MOUNT at scene B — status: "Reading the letter by lamplight. Decides not to burn it."`

Same moment, two ways of arriving, two different answers. That is the proof
that this is a stale-render bug rather than "the note isn't carried".

**Mechanism.** `src/features/maps/CharacterSnapshotPanel.tsx:94-99`:

```ts
useEffect(() => {
  setStatusNotes(snapshot?.statusNotes ?? '')
  setInventoryNotes(snapshot?.inventoryNotes ?? '')
}, [character.id, activeEventId])
```

The effect re-syncs on `activeEventId`, but `snapshot` comes from a Dexie
`useLiveQuery` keyed on that same id and resolves a tick later — so the effect
reads the *outgoing* record (and, because the textarea saves on blur and the
blur is the same click that moves the cursor, a version of it that predates the
save). It never re-runs once the query catches up. `saveField` then bases its
write on `baseData()` plus local state, so any blur commits the stale text at
the new event. `inventoryNotes` is on the same effect and has the same defect.

**Cost.** This is the one finding here that puts wrong prose into the store
silently. The natural writing order — type a note about this beat, step to the
next beat — is exactly the order that triggers it. I would not trust the status
column after this.

**Not in `docs/ux-review.md`.** Closest relative is the `HB-7a` postscript
(fields cleared after the write rather than before) and `OP-8` — same family,
different component.

---

### W-2 · high · ~~The Continuity Checker calls every death scene a continuity error~~ — **fixed**

**What I did, from scratch, in my own world.** Six steps:
1. Chapter detail for Ch.1, expanded *Marren does not come home*, `+ Characters` → **Marren Vane**.
2. Time cursor on that same scene.
3. Characters → Marren Vane → **Current State** → **Deceased** → **Save State**.
4. Opened the Continuity Checker.

**What I expected.** Nothing. I had just recorded that she dies in the scene
where she dies.

**What happened.**

> **1 warning · CHARACTERS 1**
> **Dead character Marren Vane in "Marren does not come home"**
> *Marren Vane is dead at this point — Ch. 1. Mark as Flashback if intentional.*

There is no way to record a death without generating a warning about it. The
suggested remedy — mark the scene as a flashback — would be a lie about the
manuscript.

**Mechanism.** `src/lib/continuity/computeIssues.ts:203-212`:

```ts
for (const entry of hist) {
  if (entry.order > order) break
  lastAlive = entry.isAlive
}
```

The snapshot *at* the event is included, so the record that says "she dies here"
makes her dead *going into* the scene she dies in. The rule wants strictly
earlier state (`>=`), because "dead in this scene's cast" means "already dead
when the scene starts".

**Scale, on the shipped Library.** Re-running the same rule over all 21 `.pwk`
files (the recomputation matches the app exactly on *Dracula*: the app reports
`CHARACTERS 14`, the recomputation 14):

| world | dead-in-event warnings | of which are the death scene itself |
|---|---|---|
| treasure-island | 12 | **12** |
| dracula | 14 | 10 |
| the-name-of-the-wind | 15 | 8 |
| harry-potter-and-the-philosopher-s-stone | 9 | 7 |
| the-count-of-monte-cristo | 10 | 6 |
| a-tale-of-two-cities | 9 | 5 |
| the-moonstone | 4 | 4 |
| …11 more | | |
| **total** | **96** | **69 (72 %)** |

Named examples from *Dracula*, all flagged: *Lucy Westenra in "Lucy Dies"*,
*R. M. Renfield in "Renfield Defies Dracula"*, *Captain of the Demeter in "The
Demeter in the Storm"*, and — the climax of the novel — ***Count Dracula in
"Dracula Destroyed"***.

**Cost.** A writer's first use of the shield is on the deaths they have just
written, and it tells them each one is a mistake. It is also the reason the
example worlds still open with warning counts in the dozens (*Dracula*: 54).

**Relation to a closed finding.** `CC-2` ("the shipped example reports 72 errors
and 25 warnings") was closed by fixing `CC-1`, the multi-holder item rule, which
took *Fellowship* from 97 issues to 23. That was right as far as it went; this
rule was the next-largest contributor and was not looked at. I am not saying
`CC-2` was closed wrongly — I am saying the same investigation, run once more,
finds 69 more.

---

### W-3 · med-high · ~~Knowledge's three "when" pickers are in database order~~ — **fixed**

**What I did.** *Dracula*, Knowledge, fact *"Dracula is a vampire"* →
**Learns it at…**

**What I expected.** 84 scenes in reading order.

**What happened.** 84 options in an order that *looks* sorted and is not:

```
Ch.1 — Eastward by Rail
Ch.4 — Letters Under Duress
Ch.4 — The Count in His Earth
Ch.4 — A Last Attempt at Escape
Ch.5 — Lucy Writes of Three Proposals
… Ch.6 ×3, Ch.7 …
Ch.1 — Warnings at Bistritz     ← position 12
```

The full chapter sequence of the 84 options:

```
1,4,4,4,5,5,5,6,6,6,7,1,7,7,7,8,8,8,9,9,9,10,1,10,10,11,11,11,12,12,12,13,13,2,
13,14,14,14,15,15,15,16,16,16,2,17,17,17,18,18,18,19,19,19,20,2,20,20,21,21,21,
22,22,22,23,23,3,23,24,24,24,25,25,25,26,26,26,3,27,27,27,27,27,3
```

**355 inversions, 8 adjacent backward steps.** The nine scenes of chapters 1–3
are scattered through the list at positions 12, 23, 34, 45, 56, 67, 78, 84.
Reproduced in my own six-scene world too, where the order was neither reading
order nor creation order:

```
Ch.3 — Ysolde lies to the harbourmaster
Ch.1 — Marren does not come home
Ch.2 — The strongbox
Ch.2 — Low water at the Gullet
Ch.3 — Rhun finds the letter
Ch.1 — The tide ledger
```

**Mechanism, and why this one is annoying.** `useWorldEvents`
(`src/db/hooks/useTimeline.ts:196`) returns `db.events.where('worldId').equals(…).toArray()`
unsorted — Dexie hands them back in primary-key order, and the keys are random
ids. `KnowledgeView.tsx` **already computes the right order** for its own logic:

```ts
const eventPos = useMemo(() => { … ordered by chapter.number, then sortOrder … })
```

and then renders `events.map(…)` — the raw array — in all three pickers:
*Reader learns at* (line 294), *Becomes true at* (line 317), and *Learns it at…*
(line 484 via `eventOptions`). Every other screen with an event picker sorts:
`GoalsTab` (line 25), `LorePageEditor` (186), `RelationshipsTab` (161),
`TimelineRelationshipPanel` (180). Knowledge is the only one that doesn't.

**Cost.** Recording who learns what is the whole job of this screen, and every
entry means scanning a list that is *nearly* ordered — which is worse than
plainly unordered, because you stop reading once you think you've found the
pattern.

---

### W-4 · med · ~~The Writer's Brief blanks the app it is describing~~ — **fixed differently: the panel walks the book itself**

**What I did.** Opened the Writer's Brief and tried to step the time cursor.

**What happened.** Every navigation control in the app is behind the brief's
backdrop. Probed with `elementFromPoint`:

```
nextMoment: covered by  fixed inset-0 z-[3000] bg-black/60 backdrop-blur-sm
prevMoment: covered by  fixed inset-0 z-[3000] bg-black/60 backdrop-blur-sm
navMaps:    covered by  fixed inset-0 z-[3000] bg-black/60 backdrop-blur-sm
```

`WritersBriefPanel.tsx:224` — a full-viewport dismissing backdrop under a
`role="dialog" aria-modal="true"` panel `w-80` (320 px). So 320 px of panel
makes the other 1120 px inert and blurred, including the two controls that
choose the moment the panel is about.

**Measured cost.** Reading the brief at each of my six scenes took **17
interactions and 13.0 s** (6 opens + 6 Escapes + 5 `Next moment`). Non-modal it
would be 6 — one open, five steps. Linear: about 179 vs 60 for a 60-scene novel.

**In fairness:** the brief lists the *current chapter's* scenes and clicking one
moves the cursor without closing, so within a chapter it costs nothing. It is
crossing a chapter boundary that forces the close/step/reopen. And `OP-2`
already settled that a modal intercepting clicks is defensible — but that was
about a transient action dialog. This is a reference panel about a moment, and
it hides the moment control.

---

### W-5 · med · ~~The dashboard's alive/dead count is end-of-book at every moment~~ — **fixed**

**What I did.** *Dracula*. Walked the cursor to the very first scene, read the
Characters tile; walked it to the very last scene, read it again.

```
Ch.1 · Eastward by Rail     → Characters in your cast  14 alive  11 dead
Ch.27 · The Record Closes   → Characters in your cast  14 alive  11 dead
```

At chapter one of *Dracula*, Lucy, Renfield, Quincey, Mrs Westenra, Mr Swales
and the Count are all alive. The dashboard says eleven people are dead.

**Second half, in my own world.** I marked Marren deceased at *Ch.1 — Marren
does not come home* through Current State → Deceased → Save State, with the
cursor on that scene. The dashboard afterwards: **"3 Characters in your cast · 3
alive"**, and no *dead* line at all. The snapshot says `isAlive: false`; the
character record still says `isAlive: true`:

```
name           entityIsAlive        who          at                            snapIsAlive
Marren Vane    true                 Marren Vane  Marren does not come home     false
```

**Mechanism.** `WorldDashboardView.tsx:153` counts `characters.filter(c => c.isAlive)`
— the entity flag, not the snapshot at the cursor. The code comment above it
already knows the shape of the problem ("*7 dead in chapter two tells you the
body count of a book you have not finished*") and answers it by removing the
split in *reading* mode only. In writing mode the same figure sits next to a
time cursor and disagrees with it. And the Current State tab, which is the
screen that offers **Alive / Deceased**, writes only the snapshot — so the one
number a writer would check after killing someone never moves.

---

### W-6 · med · ~~The app says "chapter" for records it keeps per scene~~ — **fixed**

I spent a while believing state was stored per chapter, because that is what the
app says. It is not — it is per scene, which is better. But four surfaces say
otherwise, and one of them makes two different records look identical.

Measured, at two different scenes of the same chapter, panel header text:

```
A cursor: Ch.3 · Ashes of the Harbour Office — Rhun finds the letter
A header: Character · Ch.3 — Ashes Of The Harbour Office
B cursor: Ch.3 · Ashes of the Harbour Office — Ysolde lies to the harbourmaster
B header: Character · Ch.3 — Ashes Of The Harbour Office
```

Byte-identical headers for two different records. The Status placeholder inside
reads *"What is this character doing this chapter?"* The character roster card
says *"No state recorded for this chapter"* (`CharacterCard.tsx:69`). The
Knowledge screen says *"Counts reflect the active chapter cursor"* when the
cursor is a scene. The journey strip under the map labels both of Ysolde's
Chapter 1 positions "Ch.1", so two distinct legs read the same.

`PAN-1` fixed the panel header contract with the words "*the moment alongside
where the panel's content is per-chapter*". The content is not per-chapter, so
the header is naming the wrong thing — this is the part of `PAN-1` I think was
settled on a wrong premise. **Credit where it is due:** the chapter-detail
Character States column *does* group by scene and gets this right, and the
"carried forward" chip is an honest and welcome cue.

**Proof the model is per-scene**, in case anyone else assumes what I did:
placing Ysolde at Ashcorn Harbour in Ch.1 scene 1 and Vellin House in Ch.1 scene
2 produced two records and both stuck.

---

### W-7 · med · ~~27 nameless buttons appear on the Timeline the moment you open a chapter~~ — **fixed**

**What I did.** *The Salt Between Us*, Timeline, expanded all three chapters
(9 scene rows), then swept `main` for controls with no `aria-label`, `title` or
text.

```
NAMELESS in main: 27       total buttons in main: 65      (42 %)
20x20 @1306,344  lucide-arrow-up
20x20 @1330,344  lucide-arrow-down
20x20 @1378,344  lucide-trash2
…×9 rows
```

Three per scene row — move up, move down, **delete** — each 20×20 CSS px, all
announced as just "button". The delete does open a `ConfirmDialog` naming the
scene, so a mis-click costs a dismissal, not a scene.

**Why the existing guard doesn't see them.** `e2e/buttonNames.spec.ts` builds a
world with one chapter and **no events**, so no scene row is ever rendered; its
`expect(bad).toEqual([])` cannot fail on this class. `e2e/controlNames.spec.ts`
visits `/timeline`, where chapter rows are collapsed by default, and
`/timeline/ch1`, which is `ChapterDetailView` — a different component whose rows
*are* named. Between them the Timeline's own `EventRow` has never been swept.

**The closed finding this contradicts.** `PH-4` says the chapter delete button
was *"the only nameless control on the entire timeline screen"*. That is false
the moment a chapter is expanded, and was false when it was written — the fix to
`PH-4` itself is fine; the claim used to justify the sweep's scope is not.

---

### W-8 · low-med · ~~The map panel title-cases the writer's own chapter titles~~ — **fixed**

My chapter is *"What the Water Kept"*. The panel header renders *"What The Water
Kept"*. My *"Ashes of the Harbour Office"* renders *"Ashes Of The Harbour
Office"*.

```
text:      "Character · Ch.3 — Ashes of the Harbour Office"
transform: "capitalize"
class:     "truncate text-[10px] capitalize text-[hsl(var(--muted-foreground))]"
title:     null
```

`PanelChrome.tsx:49` renders `${kind} · ${moment}` in one `capitalize` element.
The rule exists for `kind` (`city`, `character`), but the same line carries
`moment`, which is prose the writer wrote. It affects all four map panels, since
`PAN-1` gave them one chrome. Titles like *"the sea, and after"* come out as
*"The Sea, And After"*. The subtitle also truncates with no `title` attribute,
so the hidden half is unrecoverable — the name line above it does have one.

Not in `docs/ux-review.md`; a search for "capitali" returns nothing.

---

### W-9 · low · ~~Add Chapter and Add Event label their fields by adjacency~~ — **fixed**

Probed the open Add Chapter dialog:

```
LABEL  for=null   txt=Title
INPUT  id=""      aria-label=null
LABEL  for=null   txt=Synopsis
TEXTAREA id=""    aria-label=null
```

`AddChapterDialog.tsx:45-50` — `<Label>Title</Label>` with no `htmlFor` beside an
`<Input>` with no `id`. Same in `AddEventDialog.tsx:104-115, 187, 213`.
Repo-wide: **47** `<Label>` without `htmlFor` against **27** with.

This is a known class — `HB-2` fixed it across eight screens and `HB-7a`
explicitly names "a dialog no screen in `controlNames.spec.ts` has open" as that
check's coverage boundary. I file it only to say which dialogs are on the other
side of the boundary: the two a new writer meets first.

---

### W-10 · low · ~~Abandoned text in the map URL field blocks the file upload~~ — **fixed**

**Reproduced deliberately.** Maps → Add Map. Typed `ashcorn map` into the *or
link a URL* field (a plausible half-thought), then chose a PNG through the
picker, then pressed **Upload**.

```
dialog still open after blocked submit? true
validationMessage: "Please enter a URL."
```

The native bubble points at the field I was no longer using; the file I *had*
chosen is previewed right above it. `UploadMapDialog.tsx:149` puts a
`type="url"` input inside the same `<form>` as the submit, so browser validation
fires on it whenever it holds anything non-empty. Clearing the field let the
upload through in 3.6 s.

**Credit on the way past:** the dialog auto-filled the map name from the file
name, which is a nice touch.

---

### W-11 · low · ~~Search snippets stop mid-word~~ — **fixed**

*Dracula*, `Ctrl+K`, "lucy" → 43 results in 2.0 s, well grouped. The subtitles
read *"Mina's closest friend, desired by three suitors and preyed u"* and
*"Mina watches the sea and later searches for sleepwalking Luc"*.
`SearchPalette.tsx` — `description.slice(0, 60)` with no ellipsis, at **nine**
sites (lines 122, 127, 132, 141, 146, 151, 172, 179, 184).

---

### W-12 · low · Opening the Library hotlinks 19 covers from 5 third-party hosts — **documented, not changed**

`public/library/index.json` gives 19 of 21 entries a remote `cover`:

```
commons.wikimedia.org               12
upload.wikimedia.org                 3
marc-simonetti-shop.myshopify.com    2
static.posters.cz                    1
www.gutenberg.org                    1
```

Eight fired on opening the dialog in my session. For an app whose pitch is
local-first with no backend, browsing the Library sends the reader's IP to a
poster shop and an author's merch store. Failure is handled gracefully
(`LibraryCover` returns `null` on error, and the offline layout is fine), so
this is about what the app *does*, not about how it looks.

---

### W-13 · low · The pacing panel reserves the full width for a very small chart

On a three-chapter draft — the state this app's target user is in — the pacing
band draws **334 px** of chart (58 px gutter + 276 px plot) across a panel the
full width of the content column, ~1354 px, above the chapter list. With one
scene the plot is 46 px wide. On *Dracula* the same panel draws 3922 px and
scrolls, and is genuinely good. `TL-1` made this chart readable; nothing has
made it proportionate when there is little to plot.

---


> **Fixed.** See `docs/ux-review.md` (filed there as WRUN-1, WRUN-2 and WRUN-3,
> because that document already has a W-1 and a W-2) for what was changed and
> what the mutation sweep had to say about it — including that the first
> attempt at W-1 was incomplete, and that this run's own e2e was vacuous until
> the blur and the cursor step were made a single gesture.

## What I only suspect

Clearly separated because none of these is reproduced to the standard above.

**S-1 · You cannot say where anything is without first drawing a map.**
This part is *verified*: `LocationMarker` requires a `mapLayerId` and x/y
(`src/types/map.ts:40`), `UploadMapDialog.tsx:209` disables submit unless a file
or a linked URL is present, and the scene card's `+ Location` chip is gated on
`locationMarkers.length > 0` (`EventCard.tsx:103`) — which `EV-1` records as
deliberate. What I *suspect* is that this is the wrong default for the user in
the brief: three chapters, notes in a notebook, no map drawn. Until I made a
placeholder image, "who was where" — the thing I came for — was unrecordable.
**What would settle it:** ask five writers with drafts in progress how many have
a map image before they have a cast list. If most don't, a mapless "place" (a
named location with no coordinates, promotable to a pin later) is worth its
cost; if most do, this is fine as it stands and I am wrong.

**S-2 · The first-run guide cannot be resumed.**
Reloading at step 2 lost the wizard; `OnboardingWizard.tsx:36` holds `step` in
`useState` and the gate that shows it no longer matches once step 1 has written
a chapter. The dashboard's next-steps checklist covers the same ground, so
nothing is unreachable. I have not established that a real writer reloads
mid-wizard — I only did because I was scripting. **What would settle it:** does
anyone close the tab between naming their timeline and naming their protagonist?

**S-3 · `HB-6` (Recent Changes is too generic) is still costing something.**
It is recorded as **Stands**, so this is a data point rather than a finding. On
my three-character world, **12 of the 30** visible rows read *"Added character
state"*, *"Edited character state"* or *"Added character route"* with no name
attached, while events, locations and knowledge facts all carry theirs. I also
never knowingly added a "character route" — placing a character on the map
generates one.

---

## What worked

Honestly, and it is more than the list above.

- **The Writer's Brief is the best thing here.** *"Where was Ysolde when Rhun
  found the letter, and who else knew by then?"* — two clicks, 2.6 s, both
  halves answered in one panel: `Rhun Aldemar · The Salt Office`, `Ysolde Vane ·
  carried forward · The Gullet`, `known by Ysolde Vane, Rhun Aldemar`, and a
  `WITHHELD` line telling me the reader doesn't know yet. That is the question
  I bought the app to answer, and it answered it without my having to think
  about the data model. W-4 is a complaint about a good screen.
- **The per-scene state model is right,** and the "carried forward" chip is the
  right way to show it. W-6 is a vocabulary problem sitting on top of a sound
  design.
- **The Knowledge screen's shape is excellent** — *becomes true at*, *reader
  learns at*, *known by*, and *knowledge gaps* fed into the brief. Fix W-3 and
  it is complete.
- **Library import is genuinely impressive.** *Dracula* — 84 events, 60
  locations, 27 chapters — downloaded and opened in **1.1 s**, landed in reading
  mode with a plain explanation of what was hidden and a one-click route to turn
  it off, and warned me that re-downloading would discard my changes. The
  Timeline then painted in **369 ms** and the pacing curve was worth looking at.
- **Deletion is done well.** Every delete I hit named the thing in the confirm
  (`Delete "Low water at the Gullet"?`).
- **`Add another` on the create dialogs.** Entering three characters was three
  names and no navigation.
- **The Cast Balance panel earns its place.** *"Lucy Westenra · last on-stage
  Ch. 16 · quiet 11 chapters"* is a thing I would actually want to know.
- **Search is fast and grouped sensibly** (43 results, 2.0 s), W-11 aside.
- **Coming back works.** Cursor, world and every record were where I left them
  across every reload, with no save button anywhere.

---

## Five things I thought I had found, and didn't

Recorded because the value of this document depends on the ones above being
different from these.

1. **"Adding a scene creates two."** Three chapters came out with duplicate
   scenes. Dumping `events` with timestamps showed two of my own script runs
   3½ minutes apart — an earlier run I believed had failed had in fact written
   everything. My fault entirely; the app did nothing wrong.
2. **"The nav rail covers the map sidebar."** It does, while hovered — and
   `NavRail.tsx:42-48` says so on purpose: *"hover-expansion overlays the
   content rather than reflowing it"*, with a **Pin open** toggle that reserves
   width instead. It only bit me because synthetic clicks don't travel across
   the screen the way a hand does.
3. **"State is stored per chapter, so you can't move someone mid-chapter."**
   Measured false. Two scenes of Chapter 1, two locations, both persisted. W-6
   is what remains after this collapsed.
4. **"Every knowledge fact in *Dracula* reads `known by 0 / 25`."** True at the
   Ch.1 cursor, and correct — nobody knows anything yet. At Ch.27 the same
   facts read 6/25, 5/25, 4/25, 2/25, 1/25. The file carries 56 reveals.
5. **"The map panel disagrees with the sidebar about where someone is."** It
   doesn't. Both show the last-known position and the panel labels it
   `carried forward`.

---

### How to re-run any of this

Everything above was driven from a scratch directory, never from `e2e/`. Nothing
under `src/` was edited, nothing was committed. Screenshots for each finding are
in the run's scratch directory; the two that carry the most are the map panel
header (`Character · Ch.3 — Ashes Of The Harbour Office`, W-6 and W-8 in one
frame) and the Continuity Checker on *Dracula* (`54 warnings`, W-2).
