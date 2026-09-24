# Writer run — 24 Sep 2026 — *Condensate*, a science-fiction noir

Twelve chapters drafted from an empty world in one sitting, in Kathala 1.1.0
(production build, `vite preview`, headless Chromium 141 at 1440×900).
This is not a survey. It records the places the app got between me and the book.

---

## What I set out to write, and what I got done

**Condensate.** Meridian Station on Cassiter Bight: it rains ninety metres a
year, an atmospheric engineer is found at the foot of Condenser Nine with a
wound that doesn't match a thirty-one metre drop, and the Director of
Atmospherics has an alibi that the relay log does not support.

Finished, all of it through the UI:

| | |
|---|---|
| Chapters | 12 (1–3 scenes each: 2,2,2,3,2,2,1,3,2,2,2,1) |
| Scenes | 24, all drafted |
| Words of prose | **8,827** |
| Characters | 10 |
| Items | 6 |
| Locations | 5 (on a blank map) |
| Relationships | 8 |
| Knowledge facts | 7, with 23 reveals |
| Plot threads | 3, 22 scenes tagged |
| Character states | 34 snapshots |

The story holds, and the app is carrying the part I wanted it to carry: Oriel
Vance does not know that Saba Rhee was at Condenser Nine on the night until
Ch. 9 (*The Alibi Comes Apart*); in Ch. 3 she does not, and the Knowledge screen
says so at the cursor, with the eye-slash beside anyone who hasn't got there yet.
That single thing is why I tried this.

**Exports** (both through the UI):

- `/tmp/claude-0/-home-user-PlotWeave/0059390a-1dc2-55c6-9e96-a775864ab3c7/scratchpad/writer-run/condensate.docx` — compiled book, title page + 12 chapter headings
- `/tmp/claude-0/-home-user-PlotWeave/0059390a-1dc2-55c6-9e96-a775864ab3c7/scratchpad/writer-run/condensate.epub` — valid EPUB, linked TOC, `ch1…ch12.xhtml`
- `/tmp/claude-0/-home-user-PlotWeave/0059390a-1dc2-55c6-9e96-a775864ab3c7/scratchpad/writer-run/condensate.md` — 8,898 words incl. headings, scene breaks as `* * *`
- `/tmp/claude-0/-home-user-PlotWeave/0059390a-1dc2-55c6-9e96-a775864ab3c7/scratchpad/writer-run/Condensate.pwk` — 166 KB, `type: full`, version 18; 24 events, 24 sceneTexts, 34 snapshots, 7 facts, 23 reveals, 1 blob

One caveat on the `.pwk`, recorded under **S-2** below: the Export button uses
`showSaveFilePicker`, which headless Chromium auto-rejects with `AbortError`,
and the app (rightly) reads `AbortError` as *cancelled* and exits silently. To
get the file I removed `window.showSaveFilePicker` before clicking, which makes
the app take **its own shipped fallback** (`writeJsonWithBlobs`, the
"Firefox and other browsers" branch) — same button, same code, real download.
I do not think this is a product bug. I am flagging it because it cost me
forty minutes and because of what it implies about silent cancellation.

---

## What got in my way

### W-1 · The item history invents hand-offs that never happened *(highest cost)*

**What I did.** Ordinary order of work: draft the scenes, record where people
are as I go, *then* think about props. So Mirette Cass got a state at Ch. 6 and
Ch. 12; later I gave her the carrier chip at Ch. 6 *The Uplink Window*.

**What I expected.** Her page-of-custody to read: Mirette has it from Ch. 6.

**What happened.** Item → *Whereabouts* reads:

```
The Carrier Chip
  Ch. 6   The Uplink Window     carried by Mirette Cass · The Relay Spire
  Ch. 12  Two Decimal Places    left at The Drip
```

She never put it down. Nothing in my book says she did. The row exists because
her Ch. 12 snapshot — written days of work earlier, for a completely different
reason — has an empty inventory, and the custody resolver reads that absence as
a *decision*.

**Reproduced three times, deterministically**, on three separate items:

| Item | Phantom row |
|---|---|
| The Carrier Chip | Ch. 12 *Two Decimal Places* — "left at The Drip" |
| The Halbrand Berth Token | Ch. 5 *Director Rhee* — "left at The Administration Deck" |
| Ilm's Field Slate | Ch. 9 *Sub-Four* — "left at Condenser Nine" |
| The Brass Rain Gauge | Ch. 2 *Merrin's Table* — "left at The Compliance Office" |

**Mechanism** — `src/lib/itemCustody.ts`, the third branch:

```ts
} else if (carrierId && here.some((s) => s.characterId === carrierId)) {
  // The holder recorded a state here and it no longer lists the item.
  nextCarrier = null
  nextLocation = here.find((s) => s.characterId === carrierId)?.currentLocationMarkerId ?? locationId
```

The branch is *needed* — the comment says why, and it's right. But it cannot
distinguish "the writer took it out of her hands" from "this snapshot was
written before the item was ever in them", and the UI states the result in the
active voice: **left at The Drip**.

**What it cost.** The item page is the one screen I would open to answer *who
had the chip when*, and for four of my six items it is wrong. Worse, it's wrong
in a way I only caught because I knew the plot: nothing marks which rows are
asserted and which are inferred from an absence. If I'd trusted it I'd have
written a scene explaining a hand-off that never happened.

The trap is **order-dependent, and the natural order is the bad one.** Assign
props before you record positions and it never fires. No writer does that.

---

### W-2 · The "in the text but not on this scene" chip puts a spoken-of character on stage

**What I did.** Ch. 7 *Above the Rain* is two people on a glassed terrace. Under
the draft box: *"In the text but not on this scene: Cato Merrin, Saba Rhee"* —
both correct, both merely named in the prose. I clicked **Cato Merrin**,
expecting it to record a mention.

**What happened.** He went into **CHARACTERS** — the on-stage cast. No mention
was recorded; the Mentioned section was not even created.

**Reproduced.** Again at Ch. 10 *Stairwell Six*, a two-hander in an unlit
stairwell: clicking the **Saba Rhee** chip put her in the room. She is in a cell.

```
BEFORE:  In the text but not on this scene: / Saba Rhee / Teodor Ilm
AFTER:   CHARACTERS / Ashur Vale / Oriel Vance / Saba Rhee / + Add character…
         MENTIONED section present? false
```

**Mechanism.** `src/features/timeline/SceneDraftSection.tsx:282` — the chip's
only action is `onAddCharacter(m.characterId)`. The component already receives
`onAddMention` (line 44) and never offers it.

**Why this one is worse than it looks.** The Continuity Checker reports the
*same signal* and its button is labelled **"Record as mentioned"**, with copy
that reads:

> *Recording a name as mentioned says only that: it is in the prose. If they are
> actually in the room, add them to the cast on the scene card instead.*

Two surfaces for one signal, doing opposite things, and the careful one warns
against what the quick one does. The quick one is the one under my cursor while
I'm writing.

**What it cost.** A wrong cast is not a cosmetic error here — it feeds Cast
Balance's word-weighted screen time, the Writer's Brief's "who is present", the
"recorded somewhere else" continuity warnings, and the knowledge tracker's
co-presence suggestions. I caught both because I'd just written the scenes. On a
Tuesday in March I would not have.

---

### W-3 · Nothing in the Items section can say where an item is

**What I did.** Created six items from the Items screen. Opened *The Brass Rain
Gauge* to say it was in the silt at Condenser Nine.

**What happened.** There is no control for it. Enumerated:

- **Items roster** — 3 controls: `Generate with AI`, `Add Item`, `Search items`.
- **Item detail** — 4: upload image, link image by URL, `Delete item`, `Edit`.
- **Edit** — Name, Type/Category, Description, *"There is more than one of
  these"*. That's all.

Placement lives in exactly two places, neither of them in Items: **Maps → a
location pin → Location panel → add item** (`LocationDetailPanel.tsx:495`), and
**Characters → Current State → Inventory**. The Whereabouts section doesn't even
appear until custody is non-empty (`ItemDetailView.tsx:266`), so a new item's
page offers no hint that any of this exists.

**The guide is complicit.** Its Items section has two paragraphs — *"Putting one
down"* and *"Where it has been"* — describing this behaviour in detail, and
never says where the control is.

**What it cost.** Roughly fifteen minutes and a grep of `src/` to find that the
answer was on a screen I'd only opened to make a blank map. "Where is the thing"
is the second question about an item, after "what is it".

---

### W-4 · The Timeline won't move the time cursor to a scene — and the guide says it will

**What I did.** Timeline, expanded Ch. 1, clicked *The Body at the Base*, to put
the cursor there.

**What I expected.** The guide, *Timeline & scenes*:

> Click a scene to move the time cursor to that exact moment.

**What happened.** The row expanded. Cursor unchanged (`Ch.11 · The Director
Talks` before and after). The expanded row offers description, cast chips,
location chip and **Edit in chapter detail** — no cursor control.
`src/features/timeline/EventRow.tsx:107-110`: `onClick={() => setExpanded((v) => !v)}`.

The chapter row's **View from here** goes to the chapter's *first* moment only.
The only per-scene cursor control in the app is the tick in the bottom chapter
bar: **22 × 24 px**, correctly named (`aria-label="What the Mud Kept"`), 24 of
them across 1,100 px.

**What it cost.** Twenty minutes, because I did not disbelieve the guide — I
assumed I was clicking the wrong pixel. The time cursor is the thing the whole
app is built around and its main screen will not set it.

---

### W-5 · The murder victim is suggested as someone who might have learned he was murdered

**What I did.** Opened the fact *"Teodor Ilm did not fall — he was struck with
his own rain gauge"*.

**What happened.** **MIGHT ALSO KNOW**, first row:

```
Teodor Ilm — with Oriel Vance in Ch. 2      + learned it
```

He has a snapshot at Ch. 1 with `isAlive: false`. He is in Ch. 2's cast because
the scene is his autopsy.

**Mechanism.** `src/lib/knowledgeSuggestions.ts` — `suggestReveals` takes
`{ fact, reveals, events, chapters }` and never sees a snapshot, so it cannot
consult `isAlive`. `suggestFacts`, twenty lines above it in the same file, reads
`isAlive` to *find* deaths. The data is in the module; it isn't passed.

**What it cost.** Small but repeated: he is the top suggestion on every fact,
and I had to skip him seven times. It's also a confidence problem — a list whose
first row is obviously wrong is a list you stop reading.

---

### W-6 · The Continuity Checker's headline counts findings it isn't showing

**What I did.** Suppressed the two *"Dead character Teodor Ilm"* warnings with
the reason *"He is a body in these scenes. That is the plot."*

**What happened.**

```
Continuity Checker   [3 warnings]
CHARACTERS  1
  Teodor Ilm is in "Merrin's Table" but recorded at "Condenser Nine"
Show 2 suppressed
```

Header says 3, category says 1, list shows 1. **Reproduced after a full page
reload**, so it is not a stale render.

**Mechanism.** `src/features/continuity/ContinuityChecker.tsx:533` —
`const warnings = issues.filter((i) => i.severity === 'warning')`, feeding the
header badge at line 586. Four lines below it, `activeCount` does filter
`suppressedSet`. Errors and notes use the unfiltered form too.

**What it cost.** Little today (2 findings). It costs more the more honest you
are: the whole point of suppressing *"yes, I meant that"* is to get the number
down, and the number does not move.

---

## Where the guide let me down

The guide is unusually good — it explains *why* things are the way they are, and
twice it stopped me filing something that wasn't true. Four places it was wrong
or silent, in order of what they cost me:

**G-1 · "Click a scene to move the time cursor to that exact moment."**
False on the Timeline. See **W-4**. This is the most expensive sentence in the
document because it is about the app's central idea.

**G-2 · The prose name-matcher is described as weaker than it is.**
The Chapter-detail section says:

> The match is on the name as written: the full name, **and the first word of
> it**, as whole words and case-sensitively…

My cast is noir — everybody is a surname. I read that and concluded the "names
you wrote but didn't record" nudge would be useless for me, and started planning
to add **Also known as** aliases to all ten characters.

It was unnecessary. `nameAliases` (`src/lib/manuscript.ts:91`) returns
`bareTokens(tokens)` — *every* word of the name. Measured: Ch. 7 *Above the
Rain* contains `Rhee` ×1 and `Merrin` ×1 and never contains `Saba` or `Cato`,
and the scene card offered **both** as chips. The guide contradicts itself three
bullets later — *"Sarn finds Teodor Sarn while he is the only Sarn"* — which is
the correct rule.

**G-3 · "Nothing destructive sits in the row beside the everyday controls, so
there is no trash icon to catch a stray click on the way to open or move earlier."**
There is, in two of the places I worked:

- The Timeline's scene row: `↑ ↓ ⧉ 🗑`, the bin immediately right of *open*
  (`EventRow.tsx:184-188`).
- The world card on the selector: `Export world (single file)` at x=267,
  `More actions` at 291, `Delete world` at 311 — **20 px from Export**, and the
  thing it deletes is the whole book.

Both confirm before deleting (`ConfirmDialog`; `handleDelete → setConfirmOpen`),
and the world card's bin is deliberately `pointer-events-none` until hover, with
a good comment explaining why. So the app is defensible and the *sentence* is
wrong. That matters: it is the sentence a reviewer would quote.

**G-4 · The Items section never names the control.** See **W-3**.

**G-5 · Two surfaces for prose-mentions, one threshold, no mention of it.**
`MIN_MENTIONS = 2` (`src/lib/proseContinuity.ts:23`) gates the *Continuity
Checker*'s prose-vs-record check; the *scene card* chip fires on one occurrence.
So Ch. 7 shows me "Cato Merrin" under the draft box and the checker is silent
about him. I had to read the source to find out the two weren't contradicting
each other. Neither number is in the guide.

**G-6 · Export and the save dialog.** The guide describes `.pwk` export as
"download the file". On Chromium it opens a native **Save as** dialog
(`showSaveFilePicker`). Worth one sentence, mainly because of S-2.

---

## What I only suspect

Kept separate on purpose. None of these is reproduced to my own standard.

**S-1 · A cancelled `.pwk` export says nothing at all.** *Suspicion.*
`writeJsonWithBlobs` returns silently on `AbortError` — correct for a user who
pressed Cancel. But my forty minutes were spent in exactly that state: click,
no spinner, no toast, no console error, nothing. If a picker ever fails in a way
that *presents* as AbortError without the user having cancelled, the writer's
experience is indistinguishable from a dead button. **What would settle it:**
run the export on a real desktop Chrome with a display; confirm the picker
appears, and check whether a cancelled export leaves any trace.

**S-2 · My `.pwk` reports 4 `continuitySuppressions` and I suppressed 2.**
*Suspicion.* I made two earlier suppression attempts that I abandoned (the
confirm button's accessible name is `Confirm suppress`, and my first pass
clicked the wrong thing and escaped out). It is plausible those wrote rows.
**What would settle it:** fresh world, one suppression confirmed and one
cancelled, count rows in the export.

**S-3 · Location types are a fantasy vocabulary.**
`City / Town / Dungeon / Landmark / Building / Region / Custom`. For the inside
of a rain station I used **Building** four times out of five, which makes the
type meaningless on my map. *I did not try `Custom`*, so I do not know whether
it takes free text and solves this entirely. **What would settle it:** create a
location with type Custom and see what it asks for.

**S-4 · The dead-character warning points the wrong way.**
*"Teodor Ilm is dead at this point — Ch. 2. **Mark as Flashback if
intentional.**"* The scene is his autopsy; it is not a flashback. Suppression
works and is the right answer, but the hint sent me looking for a Flashback
toggle first. A corpse in a morgue is a normal thing for a book to contain, and
I suspect "body present" is a real gap rather than a wording nit — but I only
have one book's evidence and I did not look for prior art.

---

## Was this tool any help?

Yes. I'd use it for the next twelve chapters, and I'd be nervous about one part
of it.

**What actually carried the work was the Writer's Brief.** One click from
anywhere, ~2.6 s, and it answers the question I ask forty times a morning:
*where is everybody right now and what are they holding.* At Ch. 6 it told me
Vance was at the Relay Spire (carried forward from Ch. 5), that Mirette was
holding the carrier chip, and it printed Rhee's status note — *"Gives the Relay
Spire as her alibi for the twenty-eighth, twice, without blinking"* — next to
her name, from three chapters away. That is a thing my notebook has never once
done. If you change anything, don't change that.

**The Continuity Checker earned its shield.** It found fourteen warnings on a
world I thought was tidy, and two clicks — *Record every name as mentioned 4*
and *Move everyone to the scene 10* — took it to three. It runs in **51–80 ms**
on 24 scenes (measured three times). The *prose vs. record* category is the
cleverest thing in the app: it read my drafts and told me Mirette Cass is named
twice in a scene she isn't in.

**Cast Balance told me something true that I did not know.** *"Mirette Cass
drops out for 5 chapters mid-story."* She does, and she shouldn't; that is a
note I'd have written to myself in the margin if I'd been sharp enough.

**And the boring parts are fast and correct.** Timeline with 12 chapters and 24
scenes: 1.26 s. Manuscript with 8,827 words: 1.26 s. Chapter detail: 104 ms.
Search across every scene's prose: ~2 s. Drafts auto-save, the box grows to fit,
the paragraph counter quietly teaches you the blank-line rule, and all three
manuscript exports produced valid, readable files first time. A reload put me
back on the same screen with the same cursor.

**The nervousness is W-1 and W-2, and they are the same nervousness.** In both,
the app converts an absence or an ambiguity into a confident statement about my
story — *left at The Drip*, *Saba Rhee is in this scene* — without a single
keystroke from me saying so. The whole value of a story bible is that I can stop
holding things in my head. A bible that occasionally makes things up is worse
than no bible, because I now have to check it, and checking it is the work I
bought the tool to avoid. Neither is hard to fix: W-2 is a second button, and
W-1 is a distinction between "asserted" and "inferred" that the resolver already
has internally.

Fix those two and I'd stop keeping the parallel notebook.

---

*Findings W-1…W-6 were each reproduced in the running app at least twice, with
the mechanism located in source. S-1…S-4 were not, and are labelled as guesses.
No prior finding in `docs/records/ux-review.md` covers W-1, W-2, W-5 or W-6;
I searched for* custody, whereabouts, left at, placement, suppress *and*
plot threads.
