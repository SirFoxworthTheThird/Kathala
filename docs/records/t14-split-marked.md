# T14.0–T14.2: a split scene in the marked file

**Plan:** `round-trip-plan-4.md`, T14.0 to T14.2.
**Findings:** the first of `loop-2026-11-14.md`; the writer's W3-2, the editor's round-2 measure, part of the writer's
S-6.

## What happened

The third loop's writer split the last scene of chapter 6, *The Magistrate*, and moved its second half into a new
chapter 7 as *The Tally Desk*. The first half kept the scene's id, with the hearing written into it; the second got a
new id.

In the marked file of round 2, the half that went was struck under the first scene and put in again, unchanged, under
the second. The editor saw 10 paragraphs struck and 10 put in 30 lower. *"Now it adds."* was in the file twice, and her
*"Perfect last line. Don't touch it."* was on the struck copy.

## Measured first (T14.0)

The run's round-2 marked file is remade from the `.pwk`'s drafts, now fixtures (`draft-*.json`, `notes.json`), as
T8.0 did. The remade dialog says what the app said: **49 changes, 6 put back, 53 / 4 / 9**.
- **Paragraphs struck in one scene and put in again, word for word, in another: 9.** The editor counted 10, with the
  boots paragraph, which the writer had edited.
- **The tally's 9 *rewritten since*:** the plan guessed some were the split's. **They are not.** None of the editor's
  round-1 changes was in the half that went. 3 are in the paragraphs rewritten into the hearing, and 6 in passages
  rewritten elsewhere. The difference from the editor's own figures is T18's.

## Why

`markedPlan` marked each scene against the same scene in the editor's file. A scene made by a split had none, so all of
it was new; and the words it took were gone from the scene they came from.

## Now (T14.1)

**`basesFor`** (`markedDocx.ts`) gives each scene of the book the part of the editor's text it now holds.
- **Which scenes were split or joined** is read by Compare's own rule (`compareDrafts`), now shared: a new scene most
  of whose paragraphs were in one still there, which has lost them, is its other half. A join is the same the other way
  (`sceneLineage`).
- **A split:** the scene it came from is cut, paragraph by paragraph and in their order, into one run for each half.
  Each paragraph goes to the half that has it word for word, or has the likest paragraph to it (`likeness`, as T8.1
  pairs paragraphs). The halves are taken in the order their paragraphs stood, whichever is first in the book.
- **A paragraph neither half has**, between them, goes to the first: those are the ones the writer rewrote, and they
  were rewritten where they stayed. The run's four went into the hearing.
- **A join:** the scene that took the others in is marked against all of them, in the file's order.
- **A scene new to the file and from no other** is marked against nothing, as before.

**Measured after,** on the run's round 2:
- **0** paragraphs struck and put in again;
- *"Now it adds."* once in the file, and the editor's comment on words that stand;
- the boots paragraph marked within itself;
- rejected, the two halves are the editor's one scene, paragraph for paragraph; accepted, the writer's two.

**The dialog's count rose from 49 to 52.** The boots paragraph was one stretch put in whole; now its own edits are
counted, 4 of them, and the struck half no longer is.

## The tally (T14.2)

`editTally` now looks for each change in its own scene and in the scenes it became (`became`), each with the part of the
texts it holds. Before, a change in the half that went was read in the first scene alone, its words not found, and
counted *rewritten*. Built case: a change made in the third paragraph, the scene split before it: **stands**, where it
was counted rewritten. On the run's book, as above, nothing changes: 53, 4, 9.

## Found on the way: a scene's last paragraph cut

The probe's new cases found a fault older than this part. A scene whose last paragraph is cut whole, with another scene
after it:
- LibreOffice's own accept-all and reject-all were right;
- but the file LibreOffice saved read back in the app with the **scene break in the scene's text**: the cut was marked
  on the paragraph's own break, and the save joined the break after it to the paragraph.

**Now** a scene's last paragraphs cut, after one that stands, take out the break at the end of that paragraph, and the
last keeps its own, as Word marks it: T8.4's rule for a new paragraph, the other way. In the middle of a scene, and at
the book's end, the form is as it was; both read right before.

## LibreOffice (`npm run probe:marked`)

The reject-all and accept-all probe, with five cases added: a split in a chapter, a split whose half that went has a
paragraph rewritten, a join, the run's round 2 remade, and a scene's last paragraph cut before another and at the book's
end.
- **46 cases read right both ways**, from 44: the two scene-end cases.
- **The splits and the join:** accepted, the writer's book. Rejected, the editor's text but for the book's shape:
  - the splits differ only by the `* * *` the split put in;
  - the run's round 2 by the new chapter's heading;
  - the join by the break it took out.

  Each is right with the shape set aside (`shapeApart`, a figure added to the probe). Marking the shape is T15.
- **The other four `NO`** are T8.4's: the run's old files as sent, and the two forms forced wrong on purpose.

## Tests

- **`splitMarked.test.ts`:**
  - the run's split: the scene, and the 9 struck and put in as it was;
  - the run's round 2 now: none struck and put in; the boots paragraph within itself; the rewritten paragraphs taken
    out where they were; rejected and accepted, scene by scene; *"Now it adds."* once, the editor's comment on it; the
    count, 52;
  - `basesFor`: a split; a paragraph neither half has; one edited in the half that went; the half that went put first
    in the book; the new scene holding the first half; split in three; a join; a new scene from no other; a scene that
    lost paragraphs to nobody; the paragraphs given whole;
  - the tally: a change in the half that went stands, and read in its own scene alone was rewritten; turned back
    there, turned back; the run's 53, 4, 9;
  - a scene's last paragraphs cut: the form, beside the middle and a scene cut whole; the file as made, read back.

**Mutants**, in a separate worktree, gated on `tsc && eslint && echo MUTANT-OK && grep`. 9, all killed:
- **the plan (1):** the bases not used;
- **the lineage (2):** no split found; no join found;
- **the cut (3):** a paragraph neither half has to the later; ownership word for word only; the parts in the book's
  order. The last survived first: in every case the scene it came from was listed first anyway. A test of a new scene
  holding the first half killed it;
- **the tally (2):** not looked for in the scenes it became; what went not divided;
- **the scene's end (1):** the cut on its own break.

## Not done here

- **The book's shape** — the scene break a split puts in, a join's taken out, a new chapter's heading — is still not
  marked. T15.
- **Bringing a file in** after a split was not changed: the editor's file names the scenes it went with, and those are
  placed by their bookmarks, as before.
- **People in the split-off scene, and notes on it,** are T14.3.
