# T18: what the editor is told of their changes

**Plan:** `round-trip-plan-4.md`, T18.0, T18.1 (D-14) and T18.2.
**Findings:** the plan's first expectation, failed three runs running; the seventh of `loop-2026-11-14.md`; the editor's
F-5 and F-6; the writer's S-6.

## What happened

The third loop's editor got their edits back already accepted into the text, so the file did not say which of them
stood. To find out, they wrote a classifier that checked each of their 67 edits against the clean copy: **55 stand, 7
not taken, 5 in passages rewritten since.** The export dialog said other things:
- **the tally:** *66 changes: 53 stand, 4 turned back, 9 rewritten since*;
- **the count of marks:** *6 of those put back what they changed*;
- **the writer's note:** a list of seven changes not taken.

A declined join went out as two changes under two names. The sentence was put in as a new paragraph signed Tamsin
Hale, and taken out of the joined paragraph signed *(edit declined)*. Reject All then left an empty paragraph.

## T18.0: the measure

Round 2's tally was remade from the run's drafts, one change at a time (`editVerdicts`, which `editTally` now counts).
Each verdict was then set beside the editor's own list in their round-2 notes. They disagreed in four places:

| Change | The app said | The editor said | Why |
|---|---|---|---|
| The Ch5 join, turned back | rewritten since | not taken, declined | `markedParagraphs` wrote the join as two pieces: the first paragraph taken out whole, and its words put into the next. With only a paragraph's opening between the two pieces, the first could not be placed (`sidesIn`: both readings found). |
| *a thousand times*, *Orrin isn't coming* | rewritten since | not taken, rewritten over | Both say the same thing. In the file the writer's rewrite is signed with her own name, not as declined, so the app's figure is the one the file bears out. |
| *She did not know why.* cut | rewritten since | stands | The cut words are still gone, but the writer rewrote the sentence after them, touching the cut's place. The app counts the cut together with that rewrite. **Left as it is, and named:** the copy lists it under *rewritten since*, with its words, for the editor to read. |
| One run in the file, two of the editor's acts | 66 | 67 | Grouping, as in the first loop. |

Round 3 had one more case, and the second loop's round 3 another:
- **Two spaces put right**, *coat.I* made *coat. I* where a move had left two sentences run together, were read as
  rewritten. Their words existed only after the move, never in the text as it went. **Now** such a change stands where
  the book has it exactly as the editor left it, with the words either side.
- **The second loop's editor split a paragraph**, and the writer later took out the whole paragraph after it. That
  deletion began on the opening the split put in, so it was read as part of the split. **Now** a change that starts on
  the opening a change put in counts as beside it. Without this, that round's figure fell from 17 stand to 16.

**After:**
- **round 2:** 53 stand, 5 turned back, 8 rewritten since. Against the editor's 55, 7 and 5:
  - turned back: their 5 marked declined;
  - rewritten since: their 2 rewritten over, their 5 rewritten passages, and the cut above;
  - stand: two fewer, the cut and the grouping;
- **round 3:** 24 stand, 3 turned back, 0 rewritten since. The editor counted 23 standing and 3 declined, of 26. The
  extra change is the move that came in unpaired (T19).

## T18.1: the editor is told (D-14)

**One set of figures.** Where the tally is known, the dialog no longer gives a second count of the file's declined
marks beside it. It says *Those that turn an edit of theirs back are signed Tamsin Hale (edit declined)*, and the
tally's own figure is the one count. The file bears it out: round 2 holds 5 changes signed as declined, and round 3
holds 3, one for each change turned back.

**The copy for the cover note** (`tallyNote`) gives the figures, then each change not taken, in the order of their
file, with its chapter, scene and words (`changeSaid`), then *Every other change of yours stands as you made it.* A
change is said in its own words:
- narrowed to the words that differ, at whole words. Bringing a file in keeps a change together with the words around
  it, so a cut of *now* is stored as *"her now." made "her."*;
- as *cut "…"*, *put in "…" after "…"*, *"…" made "…"*, *a new paragraph after "…"*, *two paragraphs joined after
  "…"*, or *moved "…"*.

The dialog says how many the copy lists. Round 3's copy:

> Of Maren Hollis's 27 changes: 24 stand, 3 turned back.
>
> Turned back, each marked in the file and signed Tamsin Hale (edit declined):
> - Chapter 3, "Coil Lane": cut "then"
> - Chapter 4, "Below the Weed Line": "the gate" made "it"
> - Chapter 5, "Cellar Three": cut "He did not look up."
>
> Every other change of yours stands as you made it.

## T18.2: a declined join or split is one change

**Where a paragraph on one side is exactly two consecutive paragraphs on the other, joined by a space or by nothing,**
the change is the paragraph break between them (`MarkedParagraph.joins`):
- **a split:** the first half's break put in, and the space taken out;
- **a join:** the break taken out, and the space put in.

Each half's words are written once. Where the change turns the editor's own back, it is signed as declined; where it
is the writer's own, it is signed with her name. `changeItems` reads the break as the change, so it counts as one in
the dialog, on the way in, and in the tally. Any edit inside either half takes the paragraphs back to being paired as
before.

**With a comment in its first half**, the change is marked as before: the paragraph put in or taken out whole. In
LibreOffice, Reject All restores the space but keeps the break when the paragraph whose break is marked holds a
comment. The probe found it in all four cases: a split and a join, each declined and each the writer's own. This is the
same LibreOffice behaviour T8.4 found for a paragraph put in after a commented one. A comment in the second half is
fine.

`commentedIn` tells the export which paragraphs hold a comment, by its words. Where any of a scene's comments has
no words to sit on, it goes at the scene's start, so every paragraph of that scene counts as holding one. The marked
plan reads it the same way, so the dialog's count and the file's agree.

**In the old form, both marks are signed as declined.** The paragraph put back whole used to be signed with the
writer's name. Only a paragraph's opening stood between it and the words taken out of the next paragraph, too few to
place it. `sidesIn` now runs the words after a change on through the change that follows, as it already ran the words
before back through the change before.

## LibreOffice (`npm run probe:marked`)

Nine cases added:
- **declined-join**, **declined-split**, **own-split** and **own-join**;
- each of the four with a comment in its first half;
- a split with a comment in its second half.

**63 of 68 read right every way:** Reject All gives the editor's file, Accept All the book, and a file saved by
LibreOffice reads the same way in the app. The five `NO` are the ones T15 recorded. All nine new cases read right.

## Tests

- **`editorTold.test.ts`:**
  - round 2's figures, with each change not taken named against the editor's classifier;
  - round 3's figures, and its copy for the cover note, word for word;
  - the file's declined changes counted equal to those turned back, in both rounds;
  - `tallyNote`; `changeSaid`, its narrowing, and where it stops;
  - a split and a join as a break; a declined join and split each read back from the file rejected, accepted and with
    the writer's changes made, the sentence once and no mark in her plain name;
  - a split of the writer's own;
  - the commented fallback, both marks signed as declined; `commentedIn`;
  - round 2's Ch5 join as one paragraph, its break declined.
  - a split with no space between its halves; the dialog's declined count with a comment in the first half, two
    stretches as the file has them;
- **`shapeMarked.test.ts`**: a join of scenes after a split, in one scene: the break the join took out goes after the
  split's second half, where the editor's paragraph ends.
- **`markedDocx.test.ts`**: the T8.1 split case now has an edit in it, since an exact split is a break.
- **`splitMarked.test.ts`**: round 2 counts 51 changes, from 52, and its tally is 53, 5 and 8.
- **`markedRunFiles.test.ts`**: unchanged, and holds the second loop's round 3 at 17 stand.
- **`wordRoundTrip.spec.ts`**, in the app: the dialog's one set of figures, and the copy holding the change not taken
  with its scene and words.

**Mutants**, in a separate worktree, gated on `tsc && eslint && echo MUTANT-OK && grep`. RESULTS

## Not done here

- **The cut followed by a rewrite** (*She did not know why.*) is counted rewritten since, against the editor's
  *stands*. The copy names it.
- **A move that came in unpaired** (T19) counts as three changes, not one.
- **The copy is in the writer's voice**, for her to paste into a cover note as it stands. The figures and the list are
  the writer's to edit.
