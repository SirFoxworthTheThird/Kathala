# T15: the book's shape marked

**Plan:** `round-trip-plan-4.md`, T15.
**Findings:** the second of `loop-2026-11-14.md`; the editor's F-2, the writer's W3-4.

## What happened

The third loop's writer put in a chapter, *Chapter Seven*, with its title *The Hearing*, and a scene break before the
last scene. None of it was marked in the file sent back, and the `#` the new chapter took the place of had no deletion.
Rejecting every change left the new chapter where it was. The editor: *"Chapter Seven appears as if it had always been
there … if your software counts changes, it hasn't counted these."*

## Why

The headings and scene breaks are written afresh by each export, from the book's chapters. The marked file marked each
scene's prose against the editor's text, and never the lines between scenes.

## Now

**The editor's file's shape is read at each scene of the book** (`bookShape`, `markedDocx.ts`): what stood before the
scene there (a scene break, a chapter's heading, or nothing, for the half of a split that went on from the scene before;
nothing for a scene new to the file), and, inside a scene that took another in by a join, what stood between them. It
uses T14's parts (`sceneParts`): where each part of the file's text starts, and what a join took in.

**The export marks the book's against it** (`compileDocx`):
- **A chapter put in:** its heading lines put in, as changes, and what stood there taken out — the scene break, or
  nothing for a split's second half.
- **A chapter taken out**, its scenes running on in the one before: its heading taken out, and a scene break put in.
- **A heading renamed or renumbered:** its words struck and put in, on the one line. A comment on the heading stays on
  it, as T9.4 has it.
- **A scene break put in**, between a split's halves; **one taken out**, where a join took it.
- **Anything as it was** is written as before.

**The dialog says it:** *The book's shape is marked too: 1 chapter put in, 1 scene break put in and 1 taken out*
(`shapeCount`, `shapeSaid`). It is counted apart from the changes to the prose. On the third loop's round 2 that is the
line above.

### How a join's break is taken out

A line put in or taken out between scenes carries its own mark, as Word marks a whole paragraph selected and deleted.
**A line a join took out, with prose after it, is taken out as Word marks a paragraph cut after another:** its words
taken out, and the break at the end of the paragraph before. The probe chose it:
- **On its own break**, LibreOffice's save gave the prose after the line the line's style, *SceneBreak*. The app no
  longer read it as prose, and its words would have been lost to bringing the file in.
- **On the break before**, LibreOffice's save turned the line into a Normal paragraph whose words are taken out. So the
  reader takes such a `* * *` for the export's, as it already did a `#`. A `* * *` a writer typed in a scene's prose is
  prose still: only one whose words are taken out is not.

Three readings follow it:
- the reader keeps a scene whole across a line taken out either way (`takenOutWhole`), where it ended the scene;
- the prose either side of it stays two paragraphs, since the break taken out joins the paragraph to the line, and the
  line keeps its own;
- making the writer's changes, as bringing the file in does (`withChangesMade`): a paragraph that runs into a line left
  with no words keeps its own style. It took the line's, and the paragraph before a join's break was lost as prose. A
  unit test found it.

## LibreOffice (`npm run probe:marked`)

Five cases added: a chapter put in, taken out and renamed, a split into a new chapter, and a join across a chapter. And
one reading added for every case: **every change accepted in LibreOffice and saved, then read by the app**, as the loop's
editors sent their files back. `scripts/lo-views.py` now saves each view as Word as well as text, since text cannot show a
style.

At the commit shipped:
- **54 of 59 cases read right every way**, from 46 of 54 before this part.
- **Every split, join and chapter case:** LibreOffice's reject-all is the editor's file exactly, chapters and breaks too,
  and its accept-all is the book. Accepted in LibreOffice and read by the app, the book.
- **The join across a chapter**, saved by LibreOffice with nothing accepted and read by the app with every change
  rejected, has the heading's words as prose. LibreOffice turned the heading into a Normal paragraph, and its words cannot
  tell it from a prose paragraph an editor cut the same way, so no reading of them can set it apart safely. The app does
  not read a marked file that way: bringing one in makes the writer's changes first, and that reading is right.
- **The other four `NO`** are T8.4's: the run's old files as sent, and the two forms forced wrong on purpose.
- A split's or join's rejected text is compared as one, its scenes run together: the book has its own scenes, by its own
  bookmarks, and the editor's file its.

## Tests

- **`shapeMarked.test.ts`:**
  - a chapter put in; a chapter taken out; one renamed; a split; a join, its break taken out by the break before and read
    back as one scene of three paragraphs, rejected, accepted and with the writer's changes made; a book as it was, nothing
    marked or said;
  - the third loop's round 2: *Chapter Seven* put in, the break it took the place of taken out, the split's break put in,
    and the dialog's line;
  - `bookShape` on the run's book; `shapeSaid`;
  - the reader: a `* * *` typed in prose is prose, one taken out is not; a line taken out by its own break or the one
    before, and not by its words alone.
- **`wordRoundTrip.spec.ts`**, in the app: a scene split on the Page after a file came back; the export dialog says *1
  scene break put in*, and the file holds it put in.

**Mutants**, in a separate worktree, gated on `tsc && eslint && echo MUTANT-OK && grep`. 15, all killed, 2 by the e2e:
- **the plan (1):** the shape not handed on;
- **headings (3):** a new chapter's not put in; what it took the place of not taken out; a renamed one not marked;
- **breaks (1, and again by the e2e):** a split's not put in;
- **joins (2):** the break not taken out; on the line's own break;
- **reading (4):** a line not taken out by the break before; a taken-out `* * *` read as prose; the break before joining
  the prose; the merged paragraph taking the empty line's style;
- **the parts (1):** a split's second half read as a scene's start;
- **the count (1):** a break as it was counted;
- **the dialog (1, by the e2e):** the shape not said.

Two did not build as first written, one leaving a name unused and one narrowing a type to `never`. They were redone and
killed.

## Not done here

- **Word itself was not run**, again. The marks are Word's own forms: a heading put in or taken out whole, as Word marks a
  paragraph selected and deleted, and a join's line as Word marks a paragraph cut after another. How Word styles a
  paragraph whose mark is taken out by accepting is not measured here.
- **A chapter moved** is not marked as a move: its heading is taken out where it was and put in where it is, and its
  scenes' prose is where the book has it. Rejecting every change does not put the chapter back in its place.
- **Without chapter headings** (`chapterTitles` off) a chapter boundary is no line, so nothing of the chapters is marked;
  the breaks are.
