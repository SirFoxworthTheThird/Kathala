# Writer run — 24 August 2026 (blind)

A working session in PlotWeave, driven end to end through the real app (production
build, `vite preview` on :4173, Chromium via Playwright). I came to it as a
novelist with a second-world fantasy in my head and nothing typed: I built a
world from scratch, drafted three chapters of actual prose in the app, populated
the bible, then did the things draft two asks for — move a scene, rename a
chapter, hand an object from one character to another, kill someone, run
continuity, hunt for a half-remembered line, export the manuscript. Then I opened
one of the shipped library books and tried to use it as if it were mine.

I did not read any prior review material. Findings below are things I hit while
working, each reproduced before it was written down. Where I only suspect
something, it is in its own section and labelled as a guess.

Evidence screenshots (outside the repo):
`/tmp/claude-0/-home-user-PlotWeave/0059390a-1dc2-55c6-9e96-a775864ab3c7/scratchpad/evidence-2026-08-24/`

---

## What I set out to write, and what I got done

**The Ninth Bell** — a second-world fantasy in Cadence, a delta city of nine
bell-towers going under the tide. Rell Vashti, a bell-keeper's apprentice, wakes
to find the ninth bell silent, her master missing, and a debt-collector sitting
in her loft with two feet of bronze across his knees.

What I actually built, all through the UI:

| | |
|---|---|
| Chapters | 3 (*Low Water*, *The Debt of Salt*, *Hollowmark*) |
| Scenes with drafted prose | 6 |
| Words of prose written in the app | 1,489 |
| Characters | 4 |
| Locations | 3 (on a blank grid map) |
| Items | 2, one of which changes hands twice |
| Relationships | 5 |
| Knowledge facts, with who-learns-when | 3 |
| Character state snapshots | 12 |

Then I downloaded **The Count of Monte Cristo** from the Library (117 chapters,
149 scenes, 41 characters, 50 locations, 6 map layers), turned reading mode off,
and used it as a working draft.

I got all of that done. The app did not stop me from finishing — but it lost
data twice while I did it, and told me a flat untruth on the screen I used most.

---

## What stopped me

Ranked by what it costs a working novelist, not by how hard it is to fix.

---

### N1 — high — Recording an item hand-off silently erases the previous holder's earlier record

**This is the single most costly thing I found, because it destroys exactly the
information the app exists to keep.**

What I did (reproduction, from the UI only):

1. Created item **Ovin's Tide-Ledger**.
2. Master Ovin → *Current State* at **Ch. 1 · "The ninth bell does not ring"** →
   Inventory → *Add existing item…* → the ledger → **Save State**.
3. Opened **Items → Ovin's Tide-Ledger**. WHEREABOUTS reads:
   - `Ch. 1 · The ninth bell does not ring — carried by Master Ovin · The Gullbone Cistern`
   - `Ch. 3 · Ovin is found — left at The Gullbone Cistern`
   (`50a-ledger-before.png`)
4. Rell Vashti → *Current State* at **Ch. 2 · "Mother Sable counts"** → Inventory →
   *Ovin's Tide-Ledger (transfer from other character)* → **Save State**. This is
   the app's own supported hand-off path; the option is labelled for it.
5. Re-opened **Items → Ovin's Tide-Ledger**. WHEREABOUTS now reads:
   - `Ch. 2 · Mother Sable counts — carried by Rell Vashti · The Marrowgate`
   - `Ch. 2 · A letter under the door — left at Hollowmark Tower`
   (`50b-ledger-after.png`)

**Chapter 1 is gone.** Not superseded — deleted. The record that Ovin ever had the
ledger no longer exists.

I expected the hand-off to add a Ch. 2 row and leave Ch. 1 alone; that is what a
delta model means and what the app's own docs describe.

Confirmed at the data layer by reading IndexedDB directly. Before step 4 and
after:

```
BEFORE   Master Ovin @ The ninth bell does not ring = Ovin's Tide-Ledger
AFTER    (no such row)
```

Reproduced three times, with two different items and three different pairs of
characters:

- Rell takes **The Ninth Clapper** at Ch. 3 → Corvin Adze's Ch. 1 inventory emptied.
- Rell takes **the Tide-Ledger** at Ch. 2 → Ovin's Ch. 1 inventory emptied.
- Mother Sable takes **The Ninth Clapper** at Ch. 3 s2 → Rell's Ch. 3 s1 inventory emptied.

**Mechanism** — `src/features/characters/tabs/CurrentStateTab.tsx:249-267`:

```ts
const others = chapterSnapshots.filter(
  (s) => s.characterId !== character.id && s.inventoryItemIds.some((id) => inventoryIds.includes(id))
)
await Promise.all(others.map((s) => upsertSnapshot({ ...s, inventoryItemIds: … })))
```

`chapterSnapshots` is `useBestSnapshots(worldId, activeEventId)`
(`src/db/hooks/useSnapshots.ts:115`), which resolves *the last known snapshot at or
before the cursor* — so for a character who has not been touched since Chapter 1,
`s` **is the Chapter 1 record**, and `upsertSnapshot({ ...s, … })` keeps
`s.eventId` and rewrites it in place. The comment above it says "in the same
chapter"; the hook it reads does not do that.

**Undo is a trap here, not a rescue.** The strip is journalled as a separate
operation. Pressing Ctrl+Z **once** removes the new holder's snapshot — the screen
now looks right — but leaves the previous holder's record still wiped. It takes a
*second* undo to restore it, and nothing on screen says so. Measured:

```
AFTER SABLE TAKES IT   Sable@Ovin is found = Clapper ; Rell@The clapper changes hands = (none)
AFTER ONE UNDO         Rell@The clapper changes hands = (none)      ← still lost
AFTER TWO UNDOS        Rell@The clapper changes hands = The Ninth Clapper
```

**Cost.** Any writer who tracks a MacGuffin — the ring, the letter, the key —
loses its provenance the first time it changes hands, and the screen that would
have told them (Item → Whereabouts) is the same screen that now shows the
shortened chain. The only safe order is to enter ownership strictly
earliest-first and never revisit.

---

### N2 — high — "Current Location: Unknown / not set" for a character whose location is recorded

The Character → **Current State** tab only offers, and only displays, location
markers from **the world's first root map layer**.

Reproduction in the shipped Monte Cristo world:

1. Characters → **Edmond Dantès** → set cursor to **Ch. 1 · "The Pharaon Returns"**
   → **Current State**.
2. Status Notes loads correctly from the snapshot: *"Directs the difficult harbour
   entry while mourning Leclère and protecting the cargo."*
3. **Current Location reads "Unknown / not set."** (`92-edmond-state.png`)
4. The **History** tab of the same character, at the same scene, reads
   **"Old Port"**. (`93-edmond-history.png`) So does the Arc grid, and so does the
   map.

One panel says the location is unknown while the panel next to it names it. The
record is fine; this screen cannot see it.

**Scale.** Monte Cristo ships with 6 root map layers and 50 markers. The picker
offers 10 entries — `Unknown / not set` plus the 9 markers on the *Europe* layer
(`89b-loc-dropdown.png`). Château d'If, Dantès's Cell, the Catalans, Danglars's
Bank, the Paris Opera and 36 others cannot be chosen here at all. Counted from
IndexedDB: **373 of 417 character snapshots in that world (89.4%) point at a
marker on a layer other than the first**, so for nearly nine snapshots in ten this
tab shows "Unknown".

**Mechanism** — `src/features/characters/tabs/CurrentStateTab.tsx:36-37`:

```ts
const firstMapId = maps[0]?.id ?? null
const locationMarkers = useLocationMarkers(firstMapId)
```

`useRootMapLayers` returns an unordered Dexie `toArray()`, so *which* map is
"first" is not the writer's choice either.

**Second half: saving from this tab corrupts the record it could not read.**
`save()` writes `currentMapLayerId: firstMapId` unconditionally
(`CurrentStateTab.tsx:278`). Measured on Edmond's Ch. 1 snapshot, editing only the
status note:

```
BEFORE  { loc: loc-old-port, map: map-marseille }
AFTER   { loc: loc-old-port, map: map-europe }     ← marker and layer now disagree
```

That has a visible consequence. Clean before/after on an untouched character
(Mercédès), where I changed **nothing but a typo in the Ch. 3 status note**:

```
BEFORE   Ch. 5 · The Feast Still Believes in Tomorrow
         La Réserve
         Arrest and Imprisonment (road-and-boat)      ← travel annotation

AFTER    Ch. 5 · The Feast Still Believes in Tomorrow
         La Réserve
                                                     ← gone
```

(`96a-mercedes-before.png`, `96b-mercedes-after.png`.) `HistoryTab.tsx:180-184`
pairs two entries for route/distance only when `snap.currentMapLayerId ===
prev.currentMapLayerId`, and the save has just broken that equality. Fixing a
typo in one scene deleted a fact about the next one.

**Cost.** This is the screen a writer reaches for to answer *"where is she now?"*,
and in any world with more than one map it answers "I don't know" while quietly
degrading the record on the way out.

---

### N3 — med-high — The continuity checker's one-click fix writes false cast data

On a 1,489-word draft the checker produced **19 warnings, 17 of them of one kind**:
*"X is named in the prose but not in the cast of Y"* (`65-continuity.png`). Each
row offers a single button, **"Add to this scene."**

I took the offer 17 times — 10.8 s of clicking in automation, and the warning
count dropped from 19 to 2 (`66-continuity-after.png`). Then I read what it had
written (dumped from IndexedDB):

```
What the tide left       cast: Rell Vashti, Master Ovin, Corvin Adze, Mother Sable
The clapper changes hands cast: Mother Sable, Corvin Adze
A letter under the door   cast: Master Ovin, Rell Vashti
```

- *"What the tide left"* is Rell alone in an empty tower reading a ledger. It now
  has a cast of four, including a woman across the city and a man who has already
  left.
- *"The clapper changes hands"* is a two-hander between Rell and Corvin in a
  cistern. It now lists **Mother Sable**, who is not there, and **not Rell**, who
  is — because the prose calls her "she" rather than "Rell".
- *"A letter under the door"* now casts **Master Ovin**, who is dead.

The warning text says *"Add them to the scene or check the reference"*, but only
the first is a button. The correct fix for a mention is the scene card's separate
**+ Mentioned** chip, which is on a different screen and is not offered here.
`src/lib/proseContinuity.ts:73-79` already treats `mentionedCharacterIds` as
acknowledgement, so the data model supports the right answer; the remedy button
just picks the wrong field.

**It compounds.** Chapter detail's Character States panel now shows those four
false cast members under *"What the tide left"*, each with its own nag: *"no state
recorded — record it"* (`113-scene-cast.png`). Silencing 17 warnings created 4 new
prompts to enter state for people who are not in the room.

**Cost.** This is the most frequent warning a drafting writer meets, the fix is
one click, and taking it corrupts the record the rest of the app reads.

---

### N4 — med — The continuity checker's noise floor is high enough to train you to ignore it

Two measurements.

**On my own 6-scene draft:** 19 warnings, of which 17 were the prose-vs-cast kind
above and 1 was *"Dead character Master Ovin is named in the prose of 'Ovin is
found'"* — the scene in which his body is pulled out from under a grating. The
suggested remedy is *"Mark the scene as a flashback."* Only 1 of 19 was a
continuity error I would want to know about, and it was a good one: *"Ovin's
Tide-Ledger changes hands between characters in different places — Master Ovin
last held it at The Gullbone Cistern, but Rell Vashti has it at The Marrowgate in
Ch. 2 — they never share a location."* That is real, sharp, and worth the price of
admission.

**On the shipped, finished Monte Cristo:** 50 warnings, in 1.76 s
(`97-mc-continuity.png`). Breakdown as printed by the panel:

| Group | Count | What they are |
|---|---|---|
| Dead character in a scene | 4 | Barrois at his own deathbed, Faria remembered in the cell, Héloïse's corpse, Fernand's suicide scene — all POV/authorial choices; the offered remedy is "mark as Flashback" |
| Knows something too early | 1 | plausibly real |
| Faction: leaves with no replacement | 13 | every character who ever leaves a household in Dumas |
| Long run of one POV | 12 | e.g. *"Edmond … is the point of view for 10 scenes running. Ch. 20 → Ch. 26 — longer than this book's usual 1."* |
| Subplot raised and never resolved | 10 | e.g. *"Plot thread 'The Marseille Conspiracy' is left dangling — last advanced in Ch. 13, then quiet for the final 104 chapters"* |
| Subplot goes quiet | 9 | same family |

Fifty warnings on a finished, canonical novel. The POV and subplot checks are
craft opinions ("Fine if it is deliberate") filed in the same list, with the same
warning triangle, as *"this object is in two places at once"*. Mixing them means
the writer skims, and the one that mattered — the ledger in two places — was row 1
of 19 in my draft and would have been row 1 of 50 in a real book.

The "dead character in a scene" check is structurally unable to reach zero: a
death is recorded as a snapshot *at* the scene, and the character is (correctly)
in that scene's cast, so the death scene flags itself. Verified from the data —
all 10 death snapshots in Monte Cristo are on events whose cast includes the
dying character.

---

### N5 — med — A chapter's synopsis is write-once, and Chapter 1 can never have one

The **Add Chapter** dialog has a *Synopsis* field. Nothing anywhere edits it
afterwards.

- Timeline → chapter ⋯ menu contains exactly *"Rename chapter"* and *"Delete
  chapter"* (`22-chapter-menu.png`); rename is an inline title field only.
- Chapter detail has Scenes / Character States / Writer's Notes — no synopsis
  (`16-chapter-detail.png`).
- Manuscript's per-chapter control is a word **Goal**.
- `grep updateChapter( src/` returns three call sites: `{ title }`, `{ notes }`,
  `{ wordGoal }`. Nothing writes `synopsis`.

And Chapter 1 is created by the four-step setup guide, which never asks for one —
so the chapter every writer has is the one chapter that can never carry a summary.
Visible on my timeline: Ch. 2 and Ch. 3 print their synopses; Ch. 1 prints nothing
and there is no way to give it one (`26-book-built.png`).

The synopsis is not decorative: it prints in the Manuscript in draft mode
(`ManuscriptView.tsx:207`), in the Writer's Brief (`WritersBriefPanel.tsx:307`),
in chapter detail, and it is searchable (`SearchPalette.tsx:163`). A wrong or
missing one is permanent short of deleting the chapter.

---

### N6 — med — Recent changes cannot tell one edit from another, in the panel you use to decide what to undo

After accepting the 17 continuity fixes, the Recent changes panel showed **17
consecutive identical rows**, each reading exactly:

> Edited scene — involved characters
> 16m ago

with no scene name and no character name (`79-recent-changes.png`). Below them, in
the same undifferentiated list, sat my corkboard move of *"A letter under the
door"* into Chapter 3 and my item edits.

I found this out the hard way: probing undo, I pressed Ctrl+Z five times and
silently rolled back a structural scene move I had made twenty minutes earlier on
a different screen. The panel gave me no way to see that coming.

**Mechanism** — `describeOperation` (`src/lib/operations.ts:175-190`) names the
record from `op.payload.name ?? op.payload.title`, but a journalled *partial*
update carries only the changed fields, so a scene-cast edit has no title in its
payload and the row degrades to the bare entity label. Contrast the top-bar Undo
button, which does manage `Undo: Added scene "The ninth bell does not ring"` for a
create.

---

### N7 — med — "Who is in this scene" is two separate ledgers that never talk

I recorded Corvin Adze's location and status at *"The ninth bell does not ring"*
and at *"The clapper changes hands"*. His character page then read:

> History **2** · Appearances **0**

and the continuity checker told me he was *"named in the prose but not in the cast"*
of the very scene where I had just recorded where he was standing.

`computeProseMentionIssues` (`src/lib/proseContinuity.ts:73-79`) consults
`involvedCharacterIds`, `povCharacterId` and `mentionedCharacterIds`. It is handed
`snapshots` — it uses them for the death check — and does not consult them for
presence.

I can see the argument (cast is authorial, snapshots are state). But the effect is
that the writer who does the state bookkeeping the whole app is built around gets
told they have done nothing, and is then offered the corrupting fix in N3. If the
two are genuinely different, the character page should not print "Appearances 0"
for someone the app can place in two scenes.

---

### N8 — low-med — The Structure board's scene picker is a 10,000-pixel list with no filter

Structure → any beat → **"+ Assign a scene…"**. On Monte Cristo:

- **149 options**, measured by count.
- First option at y≈238, last at y≈10,294 — a **~10,056 px** list.
- The popover is ~150 px wide and clipped to ~250 px tall: **about 4 options
  visible at a time** (`115-assign-scene.png`).
- **0 text inputs** inside the popover — no filter, no type-ahead.

To mark the Climax of a 117-chapter novel you scroll roughly forty screenfuls in a
four-line window. The Search palette proves the app can find a scene by name in
under a fifth of a second; this control cannot.

---

### N9 — low-med — The Current Location picker is in database key order

With three locations created in the order Hollowmark Tower → The Marrowgate → The
Gullbone Cistern, the picker offered: *The Marrowgate, The Gullbone Cistern,
Hollowmark Tower.* Neither alphabetical nor creation order.

`useLocationMarkers` (`src/db/hooks/useLocationMarkers.ts:11-15`) is a raw
`.where('mapLayerId').equals(…).toArray()` with no sort, so the order is primary-key
order — nanoid, i.e. arbitrary. It *looks* sorted in the library worlds only
because their ids are name-derived slugs (`…-loc-constantinople`, `…-loc-elba`, …),
which is why I nearly filed the opposite finding. With three places it is a
curiosity; with thirty of your own it is a hunt every time.

---

### N10 — low-med — The core state-editing form has no accessible names at all

Character → **Current State**, measured live in the DOM. Every control —
*Current Location* select, *Status Notes*, the *Add existing item* select, *New item
name*, *Inventory Notes* — has `id: null`, `aria-label: null`,
`aria-labelledby: null`, and is not wrapped in a `<label>`. Two of the five have no
placeholder either, so a screen reader announces the location picker as an unnamed
collapsed button.

The Add Location dialog is the same: I dumped its HTML and the `<label>Name
(required)</label>` has no `htmlFor` and the `<input>` has no `id`
(`34-add-location-dialog.png`), so clicking the label does not even focus the
field.

Scope, counted across the source: **84 `<Label>` elements without `htmlFor` in 15
files**, concentrated in `RelationshipGraphView` (15), `CurrentStateTab` (11),
`LocationDetailPanel` (8), `FactionsView` (8), `ItemDetailView` (6). This is *not*
app-wide — I measured the Timeline screen at 117 controls, 0 unnamed — so it is a
specific set of panels, and they are the editing panels.

---

### N11 — low — The manuscript exports under the timeline's name, not the book's

Manuscript → Export → Download .md on a world called **The Ninth Bell** produced
`the-drowning-year.md` — the name of the *timeline*. The file itself is clean
(`# Ch. 1 — Low Water`, scene breaks as `* * *`, 102 lines, all 1,489 words). A
writer who exports three drafts gets three files named after an internal object
they may have named once and never seen since.

---

### N12 — low — The Arc grid's "Scenes" toggle takes about four seconds at scale

Measured on Monte Cristo (41 characters × 149 scenes = 6,150 cells): from clicking
**Scenes** to the grid being present, **4,096 ms**. Reaching the screen at all took
5,492 ms including navigation. The result is worth the wait and looks good
(`112b-mc-arc-scenes.png`) — but there is no progress indication, and four seconds
of a frozen page reads as a hang.

For contrast, everything else in that world was fast: Timeline with 117 chapters
rendered in **517 ms**; the Continuity Checker in **1,764 ms**; Search over 149
scenes returned in **160–210 ms** from first keystroke (including ~120 ms of
simulated typing).

---

### N13 — low — Moving a scene to another chapter is not in the scene's own menu

Chapter detail → scene ⋯ → the menu contains exactly **"Delete scene"**
(`71-scene-menu.png`). The capability exists in two other places — drag on the
Corkboard, and *Move to chapter* in the Timeline's bulk-selection toolbar
(`src/features/timeline/BulkActionToolbar.tsx:65`) — and the Corkboard drag worked
first time and perfectly. But the menu where I looked first has one item, and its
one item is destructive.

---

### N14 — low — The setup guide does not survive a reload

The four-step first-run guide keeps its progress in component state. Reloading the
page between step 1 and step 2 drops you on the world dashboard with no way back
into the guide; the remaining steps (add a character, place them at the opening
moment) are simply skipped. The dashboard's *"Add your first character"* /
*"Place a character on the timeline"* prompts are a decent landing, so the cost is
small — but the guide is the app's own answer to "what do I do first", and a
refresh ends it.

---

## What I only suspect

Kept separate on purpose. These are guesses; each says what would settle it.

**S1 — The relationship graph may not lay itself out until you leave and come back.**
Immediately after creating three relationships in one sitting, the graph rendered
with nodes visually overlapping and edge labels clipped (`56-rels.png`). After a
reload it was a clean, well-spaced diagonal (`59b-after-reload.png`). But when I
tried to reproduce it deliberately — measure positions, add a fourth relationship,
measure again — the new edge appeared with the correct label and the nodes simply
stayed where they were, which the code says is deliberate
(`RelationshipGraphView.tsx:479-504` preserves live positions "so stepping through
the story does not rearrange the graph"). **Tidy up** did re-run the layout
correctly when I tested it against a stale set. So I cannot tell whether what I saw
was a real transient or a screenshot taken mid-animation. *To settle it:* create
four relationships in one session with no reload and screenshot after each, at a
fixed zoom.

**S2 — I do not know the full blast radius of the `currentMapLayerId` corruption in N2.**
I proved one visible consequence (the History tab's travel/route line) and I read
`mapUtils.resolvedSnapshotLayerId`, which treats the *marker* as canonical and so
protects the map itself. I did not audit every consumer of the field. *To settle
it:* enumerate readers of `currentMapLayerId` and check each against a snapshot
whose marker layer disagrees with it.

**S3 — Empty inventory may be an assertion rather than a silence.**
I saved Rell's state at *"A letter under the door"* before she had the ledger. Once
she picked it up in an earlier scene, the item page reported
`Ch. 2 · A letter under the door — left at Hollowmark Tower`, i.e. it concluded she
had put it down. That may be exactly right by the delta model, or it may be that a
snapshot saved for one reason (a status note) silently asserts "carries nothing"
about everything else on the form. *To settle it:* decide whether a snapshot's
empty `inventoryItemIds` means "empty-handed" or "unspecified", and check the
Whereabouts renderer against that decision. I lean towards this being working as
designed, which is why it is here and not above.

**S4 — I could not find a per-warning "this is fine" that persists.** Each
continuity row has an eye-slash icon which I read as suppress, but I did not test
whether a suppression survives a reload or applies to the class or the instance.
Given N4, whether suppression is durable decides whether the noise is a one-time
tax or a permanent one.

---

## What worked

Not flattery — these are the parts carrying the app, and a change that breaks any
of them would cost more than fixing everything above.

**The prose editor and its autosave.** The scene draft box auto-grows, keeps a
sane measure (~720 px, 340 words rendered legibly), and saves on a 1 s debounce
*with a flush on unmount* (`SceneDraftSection.tsx:178-184`). I typed a sentence and
navigated away in the same tick; it was in the database. This is the one thing
that must never fail, and it doesn't. The comment above it — *"prose is the one
thing in the app nothing else keeps a copy of"* — is the right instinct.

**Search.** `Ctrl+K`, full text across scene prose with snippets, plus items,
chapters, relationships and knowledge facts. *"flour crock"* found both scenes I
half-remembered; *"salt-bond"* returned two scenes, a relationship and a knowledge
fact. 160–210 ms on 149 scenes. This is the feature that repays the bookkeeping
fastest.

**The Writer's Brief.** *"Where was she when he left the letter, and who knew by
then?"* — one click from any screen, answered on one panel: Rell at Hollowmark
Tower carrying the bell-hook, plus *Knowledge in the room* with who knows what as
of that scene (`70-brief.png`). This is the app's best single screen.

**The Character Arc grid.** Cast down the side, chapters or scenes across, location
and note in each cell, carried-forward states greyed, the dead struck through
(`68-arc.png`, `112b-mc-arc-scenes.png`). It makes the snapshot model legible in
one glance, which is the whole argument for the snapshot model.

**Item Whereabouts** — when the data survives N1. `carried by X · at Y`, then
`left at Z`, in story order, inferring a drop from a later empty-handed snapshot.
That inference is genuinely clever.

**The Knowledge model.** Facts with *becomes true at*, *reader learns at*, and a
per-character *learns it at*, with counts that respect the cursor (*"known by 3 /
4"* at Ch. 1, *"4 / 4"* later). And it volunteered *"SUGGESTED FROM YOUR STORY:
Master Ovin is dead · Ch. 3"* off the back of a death I had recorded — the only
place in the app that offered me work I actually wanted.

**Manuscript view and export.** Serif, indented, chapter headings, per-chapter word
goals, Find & Replace, and five export formats. The Markdown came out clean enough
to hand to anyone.

**Corkboard drag.** I dragged *"A letter under the door"* from Chapter 2 into
Chapter 3 and it went, with word counts and scene counts updating on both columns
immediately. No fuss.

**Graceful degradation on the map.** With no outbound network, the Monte Cristo map
image failed to load and the app said so in one calm bar — *"This map's picture
could not be loaded… Everything marked on the map is still here"* — then drew all
the markers, routes and character pins anyway (`106-mc-map.png`).

**Places without a map.** *"Start a blank map"* gives a plain grid you can drop pins
on, which is the right escape hatch for a novelist who does not want to draw a
world. The empty state explains the constraint honestly rather than hiding it.

**Coming back.** The dashboard's *Recently edited* list names the last five scenes
with chapter and elapsed time, the time cursor is where I left it, and snapshot
coverage (83%, 5/6 scenes) is a genuinely good single number for "how much
bookkeeping is outstanding" (`103-return.png`).

**Scale.** 117 chapters in half a second, continuity across 149 scenes in under two.

---

## Verdict

**PlotWeave genuinely helps a particular novelist, and gives most novelists more
work to do. Which one you are is decided by a single question: does your book have
a state-tracking problem that a linear read-through cannot solve?**

If it does — a large ensemble, a long timeline, an object or a secret that moves
between people, a plot where "who knew what by chapter nine" is load-bearing —
then PlotWeave earns its keep, and it earns it at a specific, identifiable moment:
**the second draft of a book that already exists.** The Writer's Brief, the Arc
grid and full-text search over your own prose answer, in one click and under a
second, questions that otherwise cost a twenty-minute scroll through a manuscript
and usually get answered wrong. That is real money. The Knowledge model is the
best implementation of "who knows what, and when" I have used, and the time cursor
is the correct central idea — not a clever one, a correct one: every screen
answering "what is true at this exact moment" is what a story bible is *for*, and
almost no other tool does it.

If it does not — an intimate novel, three or four people, one place, a linear
timeline — then this is a second job. Recording one character's position in one
scene costs seven interactions from the Characters screen; a six-scene chapter
with four people is a morning. Nothing in the app writes itself: I typed 1,489
words of prose and then spent longer than that entering where everyone was
standing, and the app's reward for the second half was to tell me I had a cast of
zero and hand me nineteen warnings.

Three things stand between the good version of this tool and the writer, and they
are not cosmetic.

**First, it loses data on the exact operation it advertises.** "Track items across
every chapter" is on the tin, and handing an item from one character to another
deletes the previous owner's record of ever having held it (N1). It survives a
single undo. A story bible that quietly rewrites history is worse than a notebook,
because a notebook does not lie to you with a straight face — and the Whereabouts
screen, which is otherwise excellent, will show you the shortened chain and you
will believe it.

**Second, its most-used editing screen tells an untruth.** In any world with more
than one map, Character → Current State says "Unknown / not set" for a location it
has on file (N2). In the app's own flagship example that is nine snapshots in ten.
A tool whose job is to be the authority on where people are, saying "I don't know"
about something it does know, is a specific and expensive kind of broken: you stop
trusting the answer, and once you stop trusting the answer you stop looking, and
once you stop looking you are back to grepping the manuscript.

**Third, the continuity checker — the feature that most justifies the
bookkeeping — has a noise floor that trains you to ignore it, and its one-click fix
makes the record worse.** Fifty warnings on a finished Dumas novel, of which
twenty-two are craft opinions about POV runs and dangling subplots. Nineteen on my
six scenes, of which one was worth reading — and it was excellent, catching an
object in two places at once that I had not noticed myself. That one warning is the
whole promise. It was drowning in seventeen copies of a complaint about
bookkeeping I had not done, each offering a button that, when pressed, put a
character in a room she was not in.

So: **for whom, and when.** For the writer of a long, populous, multi-thread novel
who has finished a draft and is about to revise it, and who is temperamentally
willing to keep a bible at all — yes, and the point at which it starts paying is
roughly the third chapter, once the Brief and the Arc grid have something to show.
For a first-draft writer of anything, no: it will pull you out of the prose to
maintain a ledger about a book that is still changing shape under you, and the
delta model punishes exactly the reordering that drafting consists of. For anyone
writing something short or close-focused, no, and not close.

And for everyone: not until N1 is fixed. Everything else on that list is friction,
and friction is survivable. N1 is the tool destroying the writer's work in the
course of doing what the writer asked, and no amount of good screens above it
compensates for that.
