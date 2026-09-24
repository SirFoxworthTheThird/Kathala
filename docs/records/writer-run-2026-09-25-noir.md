# Writer run — 25 Sep 2026 — *A Clean Recollection*, a science-fiction noir

Twelve chapters written from an empty world in one sitting, in Kathala 1.1.0
(tip `5a1c8c59`, production build served by `vite preview`, headless Chromium at
1440×900). Everything below was done through the UI. This is not a survey of the
app; it records the places the app got between me and the book.

---

## What I set out to do, and how far I got

**A Clean Recollection.** Vantage is a decommissioned shipyard habitat over the
dead world Calloway, where nothing recorded is admissible anywhere — which is
why memory brokers work there. A licensed declarant is hired by a widow to
verify her husband's last engram and finds nineteen minutes missing and seven
minutes built to cover the hole.

Finished, all of it through the UI:

| | |
|---|---|
| Chapters | 12 (scenes per chapter: 2,2,2,3,2,2,1,3,2,2,2,1) |
| Scenes | 24, all drafted |
| Words of prose | **11,200** (the app's count; 11,270 in the Markdown export, which includes chapter headings) |
| Characters | 10 |
| Items | 6 |
| Locations | 5, pinned on an uploaded deck schematic |
| Relationships | 8 |
| Knowledge facts | 7, with 41 reveals |
| Character states | 55 snapshots — snapshot coverage 24/24 scenes |
| Continuity | **No issues found** at the end |

**Exports, both through the UI:**

- `/tmp/claude-0/-home-user-PlotWeave/0059390a-1dc2-55c6-9e96-a775864ab3c7/scratchpad/writer-run/exports/a-clean-recollection.docx` — 88 KB, title page (*A Clean Recollection · R. Oda*), 12 chapter headings, 12 italic runs
- `/tmp/claude-0/-home-user-PlotWeave/0059390a-1dc2-55c6-9e96-a775864ab3c7/scratchpad/writer-run/exports/a-clean-recollection.epub` — 74 KB, valid structure, linked TOC, `ch1…ch12.xhtml`, `_underscores_` rendered as `<em>`
- `/tmp/claude-0/-home-user-PlotWeave/0059390a-1dc2-55c6-9e96-a775864ab3c7/scratchpad/writer-run/exports/a-clean-recollection.md` — 59 KB
- `/tmp/claude-0/-home-user-PlotWeave/0059390a-1dc2-55c6-9e96-a775864ab3c7/scratchpad/writer-run/exports/a-clean-recollection.html` — 62 KB
- `/tmp/claude-0/-home-user-PlotWeave/0059390a-1dc2-55c6-9e96-a775864ab3c7/scratchpad/writer-run/exports/A_Clean_Recollection.pwk` — 204 KB, `type: full`, version 18; 12 chapters, 24 events, 24 sceneTexts, 10 characters, 6 items, 5 markers, 55 characterSnapshots, 4 itemPlacements, 8 relationships, 7 facts, 41 reveals, 1 blob, 3 tombstones

Screenshots for every finding below are in
`/tmp/claude-0/-home-user-PlotWeave/0059390a-1dc2-55c6-9e96-a775864ab3c7/scratchpad/writer-run/shots/`.

The `.pwk` needed the workaround recorded as **S-2** in the previous run; see
**S-1** here.

---

## What stopped me

### W-1 · **Record state** does nothing, silently, exactly when the guide says it is a single click *(highest cost, and the only one that touched my data)*

**What I did.** The ordinary thing: walk down a chapter's Character States panel
and answer the three questions for each cast member. On Ch. 2 *The Widow's
Retainer*, the row read **Isko Marn — no state recorded — record it**. I clicked
it. The form opened pre-filled with **Marn's Office** and the notice *"Filled in
from where they were last recorded. Saving pins it to this scene."* Isko is in
his office in that scene. So I pressed **Record state**.

**What I expected.** The row to stop saying *no state recorded*.

**What happened.** The form closed. The row still reads **no state recorded —
record it**. No toast, no error, no console output, nothing.

**Reproduced.** Twice in a row on that exact row, then after a full page reload
— still unrecorded. Then as a controlled paired test on a throwaway scene, which
I deleted afterwards:

```
ZZ Control 2 (Ch. 12), cast = Isko Marn, prefill "Authority House"
ABSENCE   press Record state, nothing changed  -> rows still "no state recorded": 1
PRESENCE  reopen, type "control" in Note, press -> rows still "no state recorded": 0
```

Both halves in one run, so this is not a vacuous observation about a row that
was never going to change.

**Mechanism.** `src/db/hooks/useSnapshots.ts:194`

```ts
if (prevBest && charSnapContentEqual(data, prevBest)) {
  return prevBest // unchanged — no new record needed
}
```

`charSnapContentEqual` compares alive, location, map layer, inventory, inventory
notes, **status notes** and travel mode. The quick form's prefill
(`draftFromSnapshot`, `src/lib/quickState.ts`) carries alive and location
forward and deliberately blanks the note — so if the previous record also had no
note, the write is byte-identical to the last-known state and is dropped. The
panel then correctly reports that there is no snapshot at this `eventId`
(`src/features/timeline/ChapterDetailView.tsx:130`).

The dedupe is right for a delta model. The problem is that the *one* interaction
the form was built for is the one it refuses.

**The guide promises this case by name**, in *Chapter detail*:

> It arrives filled in from where that character was last recorded — saying so,
> so you can tell it apart from something already written here — **which makes
> confirming that somebody hasn't moved a single click.** Saving pins it to that
> scene and nothing else.

Confirming that somebody hasn't moved is precisely the no-op.

**What it cost.** It fired on **9 of the 62 cast-rows** in my book — every scene
that happens in the same room as the previous one with the same person, which in
a noir is Ch. 2 (office, then office), Ch. 10 (parlour, then parlour) and Ch. 11
(the vault, twice). Three whole chapters of state recording appeared to work and
none of it landed. I only found out because I went back and read the panel.
I got past it by inventing a status note for each of those nine rows purely to
make the button take — which means nine notes exist in my book because the app
needed a difference, not because I wanted to write them.

The dangerous shape is the silence. A writer who presses that button and moves
on has a scene with no record and a panel that never told them.

Not in `docs/records/ux-review.md` — I searched for *record state*, *no state
recorded*, *quickState*, *RecordStateInline*, *charSnapContentEqual*.

---

### W-2 · The item custody chain still invents hand-offs — the previous run's **W-1** was closed on a change of wording, not of behaviour

The brief says *"the item-custody history no longer invents hand-offs."* It
does. It has stopped naming a place and stopped using the active voice, and the
invented row is still in the list.

**What I did.** Same natural order as last time, and I did not do it on purpose:
draft the scenes, record where everybody is, then think about props. Isko Marn
carries his declarant seal for the whole book. Sister Vey never lets go of the
Ossuary key — the whole of Ch. 11 turns on her not letting go of it.

**What the item pages say.** Items → *Marn's Declarant Seal* → **Whereabouts**:

```
Ch. 1   The Body in the Freight Lock    carried by Isko Marn · Bay Nineteen
Ch. 1   A Retainer in Cash              no longer in Isko Marn's inventory
Ch. 8   The Assay Foil                  carried by Isko Marn · Bay Nineteen
Ch. 8   Vey Buries It                   no longer in Isko Marn's inventory
```

Four of my six items carry at least one such row:

| Item | Invented row |
|---|---|
| Marn's Declarant Seal | Ch. 1 *A Retainer in Cash*, Ch. 8 *Vey Buries It* |
| The Ossuary Key | Ch. 8 *Vey Buries It* — "no longer in Mirran Vey's inventory" |
| Lask's Service Pistol | Ch. 5 *Walked Home*, Ch. 12 *A Clean Recollection* |
| The Brant Assay Foil | (the Ch. 8 *left at The Ossuary* row is mine and correct) |

**Mechanism.** `src/lib/itemCustody.ts`, third branch — unchanged in substance.
The step is now `kind: 'unlisted'` and `describeCustodyStep` returns
*"no longer in X's inventory"* instead of *"left at Y"*. The doc comment on
`CustodyStep.kind` says it plainly: *"That is a gap in the record, not a
hand-off."* But `src/features/items/ItemDetailView.tsx:348` renders every step
through the same `<li>`:

```tsx
className="flex items-baseline gap-2 rounded border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2 text-xs"
```

`step.kind` reaches the screen only through the sentence. I measured the
computed styles: the asserted rows and the inferred rows share border,
background, colour and opacity. Screenshot `71-seal-custody.png` shows four
identical rows, two of which are false about my book.

**Why I'm calling this half-closed rather than filing it fresh.** The previous
finding's stated cost was *"for four of my six items it is wrong… nothing marks
which rows are asserted and which are inferred from an absence."* Both halves of
that sentence are still true at this tip, with the same four-out-of-six ratio,
from the same natural order of work. The fix addressed the third sentence — the
active voice — and left the finding's actual claim standing. I would re-open it,
and I think the answer is either to mark the inferred rows or not to emit them.

**What it cost.** Less than it cost the last writer, only because I had read
their report. The item page is still the screen I would open to answer *who had
the seal when*, and it is still wrong four times out of six.

---

### W-3 · The backup chip and the backup nudge both land three screens above the backup

Both of these shipped an hour before I started, so here is what a first reader
does with them.

**What I did.** The top bar carries **Not backed up** beside the world name,
which is a good thing to be told and is quiet enough not to nag — it sits in
muted amber at 11px, it does not move, and I stopped noticing it after ten
minutes. The dashboard's version is one of three stacked nudges (*Keep a copy of
this world in a folder*, *Define how your characters relate*, *Document your
world's lore*), each with its own dismiss ✕. Neither reads as nagging. That is
the part that works.

Then I clicked the chip, because I had 11,000 words in one browser profile.

**What I expected.** The guide, *What leaves your device*:

> Clicking it opens [Folder and cloud sync](#folder-and-cloud-sync), where you
> choose the folder — or, in a browser without the folder picker, export a copy
> instead.

**What happened.** It opens **World settings at the top** — the WORLD section,
name and description and cover image. **Cloud Sync** is the eleventh of eleven
sections. Measured twice, identically: the *Cloud Sync* heading sits at
`getBoundingClientRect().top = 2849px`. The URL carries no anchor.
`src/components/FolderSyncIndicator.tsx:96` is `navigate(\`/worlds/${worldId}/settings\`)`.
The dashboard nudge lands in exactly the same place — same 2,849 px.

The section-index chips at the top of Settings *do* jump correctly, so the
machinery exists and neither entry point uses it.

**And the screen it lands on cannot make a backup file.** The only export in
World settings is **Export as HTML** — "a read-only, shareable snapshot" — which
cannot be imported. The `.pwk` lives on the world card's menu back on the world
list. So the control that exists to say *the only copy of your book is in this
browser* delivers you to a screen where you cannot fix that, and does not say
where you can.

**What it cost.** About five minutes, and a wrong conclusion I held for most of
the session: I came away from Settings believing there was no in-world `.pwk`
export at all.

---

### W-4 · The Timeline's scene rows still carry a bare trash icon, 24 px from the everyday control — and the guide still says they don't

**What I did.** Expanded Ch. 3 on the Timeline to move a scene. Each scene row
carries four 20×20 icon buttons. Measured:

```
Move to the end of the previous chapter: Playback   x=1306
Move Playback later                                 x=1330
Open the chapter holding Playback                   x=1354
Delete Playback                                     x=1378
```

The bin is the next target along from *open*. The guide, *Timeline & scenes*:

> **Deleting is always one step in.** … Nothing destructive sits in the row
> beside the everyday controls, so there is no trash icon to catch a stray click
> on the way to *open* or *move earlier*.

`docs/records/ux-review.md` **TL-3** records this shape as fixed at four sites —
"the chapter row, the scene card (**EV-5**), the character header (**CH-4**) and
the lore card (**LORE-1**)". The Timeline's *scene* row is a fifth and was
missed; the chapter rows above it do have the menu. The previous writer run
filed the same sentence as **G-3** and it is still there.

**It does confirm.** I made a throwaway scene and clicked the bin: *Delete "ZZ
Throwaway"? / Cancel / Delete*. So this is a paper cut and a wrong sentence in
the guide rather than a data risk. I rank it here only because it is the
sentence a reviewer would quote, and it has now survived one report.

---

### W-5 · The panel that takes the answer will not take a correction

**What I did.** The first-run guide placed Isko Marn at Ch. 1 with no location —
it asks which scene, not where. Later I wanted to say *Bay Nineteen*. His row in
the Character States panel shows his state; I clicked it.

**What happened.** Nothing. A row with a state recorded is an inert `<div>` —
verified in the DOM: no `role`, no `tabindex`, no handler, no button anywhere in
the panel for it. `src/features/timeline/ChapterDetailView.tsx`:

```tsx
const Row = onRecordState ? 'button' : 'div'
```

…applies only to the `uncast` rows. `SnapshotCard` has no affordance at all.

**What it cost.** The correction took: Timeline → expand chapter → expand scene →
**View from here** → Characters → Isko Marn → **Current State** → pick location →
**Save State**. Seven interactions across three screens, and the cursor has to be
moved first or the editor answers about the wrong moment. That is the exact cost
`quickState.ts`'s own doc comment quotes from two earlier writer runs as the
thing it was built to remove. It removed it for *recording* and left it for
*fixing*, and fixing is the thing you do more of.

---

### W-6 · Location types are still a fantasy vocabulary, and **Custom** is not an escape hatch *(settles S-3 from the previous run)*

The last run left this as a suspicion: *"I did not try `Custom`, so I do not know
whether it takes free text."* It does not.

**What I did.** Maps → **+ Location** → clicked the map → opened **Type**. The
seven options are City, Town, Dungeon, Landmark, Building, Region, Custom.
Choosing **Custom** shows no additional field (screenshot
`24-custom-chosen.png`); it is a literal enum member
(`src/types/map.ts:35 | 'custom'`, listed with the other six in
`src/features/maps/MapFilterBar.tsx:29`).

**What happened.** My map of a space station now reads *Bay Nineteen · Building*,
*The Lacuna · Building*, *The Ossuary · Building*, *Authority House · Building*,
*Marn's Office · Custom* (screenshot `25-locations.png`). The word "Custom" is
printed on the pin as if it were a kind of place. The location-type filter in the
**Show** chips is useless on this map because four of five places are the same
type and the fifth is a placeholder.

**What it cost.** Two minutes and a small wrong hope. Filed because the previous
run's suspicion deserves closing one way or the other, and because the cost is
not zero for anyone writing indoors.

---

### W-7 · The fact composer closes after every fact

Knowledge → **New Fact** opens a field in the header; **Create** makes the fact
and closes the field. Seven facts meant seven round trips. Characters and Items
both offer **Add another character** / **Add another item** in the same
situation. Roughly a minute. Smallest thing here.

---

## What I only suspect

Kept separate. Neither of these is reproduced to the standard of the section
above.

**S-1 · A `.pwk` export that fails is indistinguishable from a dead button.**
*Partly reproduced, partly environmental.* I clicked **Export world (single
file)** on the world card and waited 23 seconds: no download, no toast, no
console error, no visible change anywhere on the page (`100-after-export-click.png`).
In this environment that is headless Chromium auto-rejecting `showSaveFilePicker`
with `AbortError`, which the app correctly reads as *cancelled*. I used the
workaround the previous run recorded — deleting `window.showSaveFilePicker`
before the click, so the app takes **its own shipped fallback branch** — and got
a real 204 KB file on the first try, same button, same code path the app already
ships for Firefox. So I am not calling the export broken.

What I am flagging, exactly as the last run did and with the same evidence, is
that **a cancelled export and a failed export look identical, and both look like
nothing.** The writer cannot tell which they got. **What would settle it:** run
on a desktop Chrome with a display and confirm the picker appears; then decide
separately whether a cancel deserves one line of feedback, because right now the
silence is doing double duty.

**S-2 · Two counts of the same thing, six inches apart, disagreeing.** At the
Ch. 6 cursor, the Knowledge roster card for *Delphine Voss was in Bay Nineteen at
20:53* reads **known by 3 / 10**, and the panel open beside it reads **KNOWN BY
(7)**. The list itself is right — four of the seven carry an eye-slash — and the
two numbers mean different things (ever, versus at this moment). Nothing on
screen says so. I read it correctly in about two seconds and I am not sure it is
a problem at all. **What would settle it:** watch somebody else read that screen
cold.

**Withdrawn before filing.** I was going to file that Cast Balance's *"drops out
for N chapters mid-story"* summed separate gaps, because it said *Cardinal Suhl
drops out for 6 chapters* when he had two gaps of three and two. It was right and
I was wrong: he was genuinely absent Ch. 4–9 at the time I read it, because I had
not yet added him to Ch. 7's cast. `castBalance.ts` reports `longestDormancy`,
which is what it says. After I fixed the cast it read *3 chapters*, correctly.
Recorded here because the near-miss is the point.

---

## What worked, briefly

Only the things that actually carried the session, so that nobody undoes them.

**The Knowledge tracker is why I would use this.** *Who knew Delphine was in Bay
Nineteen, and by when?* — cursor to Ch. 6, open Knowledge, click the fact: **7
seconds, two screens**, and the answer is a list in story order with an
eye-slash beside the four who do not know it yet. The roster card counts to the
cursor (*known by 3 / 10*) and moves as the cursor moves. Nothing in a notebook
does that.

**The Writer's Brief is the second reason.** 2.6 s, one click from anywhere, and
at Ch. 9 it gave me all ten characters with their carried-forward positions,
their status notes from up to four chapters earlier, Emery Voss struck through
with a skull, and **Knowledge in the room** — which correctly withheld Teagan
Reyes from the Bay Nineteen fact, because she learns it in the *next* scene.

**The Continuity Checker found a real mistake of mine.** It reported seven
prose-vs-record observations on a book I thought was tidy, and one of them —
*"Cardinal Suhl is named in the prose but not in the cast of Nightside"* — was
not a mention at all. He is the other person in that room and I had forgotten to
put him in the scene. I would not have caught that. The bulk **Record every name
as mentioned** then cleared the remaining six in 3.0 s, and the headline count
and the list agreed throughout (the previous run's **W-6** is fixed).

**Three of the previous run's six findings are genuinely fixed, and I checked
rather than assumed.** The scene-draft chip now says *"Named in the text — click
to record as mentioned"* and creates a MENTIONED section instead of adding to the
cast (verified on Ch. 2: `BEFORE` chip → `AFTER` MENTIONED: Cardinal Suhl, cast
unchanged). Items have **Where it is** on their own page with the caption
*"Recorded at the scene the cursor is on."* — I placed four items with it. Each
expanded scene row on the Timeline has **View from here**, and it works. Dead
characters never appeared in **Might also know** on any of my seven facts, and
Emery Voss would have led every one of them.

**Everything is fast.** Cold full loads: Timeline 565–626 ms, Manuscript with
11,200 words 595–619 ms. Screen-to-screen within the app: 319–376 ms across
eight screens. Continuity on 24 scenes: 2.6 s. Search across every scene's prose:
2.9 s, five results with highlighted context. Drafts auto-save on a second's
pause and say which state they are in. All five export formats produced valid
files first time, with `_underscores_` correctly set as italics in the DOCX and
the EPUB. The cursor survived closing the browser (came back on Ch. 9 · The Raw
Take, where I left it).

**And the Noir theme is not decoration.** It sets the manuscript in a typewriter
face at 15px/24px with a measured contrast ratio of **14.8:1**. I went looking
for a contrast complaint and the measurement said there wasn't one.

---

## Was the tool any help?

Yes — more than last time, and I would keep using it for this book.

Two things earn it, and they are the same thing: the Knowledge tracker and the
Writer's Brief both answer *what is true at this exact moment* in under three
seconds, and they are both right. A twelve-chapter mystery is a machine for
losing track of who knows what, and for one morning I did not have to hold any
of it. That is what I came for and I got it.

What I would want changed before I stopped keeping a parallel notebook is
**W-1**, and it is not close. Everything else here is friction; W-1 is the app
telling me it did not do something, in a way I can only discover by going back
and looking. Three chapters of my state records silently did not exist. The fix
is small — the form knows it made no change and could either say so (*"No change
to record — Isko is still at Marn's Office"*) or write the row anyway — but until
one of those happens, the Character States panel is a surface I have to
double-check, and double-checking is the work I was trying to stop doing.

**W-2** is the same anxiety in a quieter voice. The app has been told, in a
comment in its own source, that an absent inventory is not a hand-off — and it
still prints one row per absence, in story order, styled exactly like the rows I
wrote myself. A story bible that occasionally states something my book does not
say is worse than a shorter one, because I now have to check it. The wording fix
made the row less wrong; it did not make it true.

The rest I would live with. **W-3** is a five-minute wrong turn that costs
exactly once. **W-5** is an annoyance that scales with how careless you are.
**W-4**, **W-6** and **W-7** are paper cuts, and I am flagging W-4 mostly because
the guide says the opposite and has now said the opposite through two reports.

One last thing, said plainly because the brief asked: the **backup chip did not
nag me**. It is the right size, the right colour, and it never moved. It is only
the destination that is wrong.

---

*W-1 through W-7 were each reproduced in the running app at least twice, with
the mechanism located in source; W-1 additionally has a paired
absence/presence control test on a throwaway scene, which I deleted afterwards
(the book is back to 24 scenes, 11,200 words). S-1 and S-2 are not reproduced to
that standard and are labelled as suspicions. I searched
`docs/records/ux-review.md` for* record state, no state recorded, quickState,
custody, whereabouts, left at, trash icon, backup, folder sync *and* location
type *before filing.*
