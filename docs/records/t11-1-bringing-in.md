# T11: bringing a file in

**Plan:** `round-trip-plan-3.md`, T11.1 to T11.4.
**Findings:** the eleventh to thirteenth of `loop-2026-11-12.md`, and the writer's F6, F4 and F7, and one of their
smaller ones.

## T11.1: a change says before the click whether it can be made

**What happened.** In the second loop the writer typed one of the editor's changes in by hand: *four hours in the
rain* made *all morning, and the last of it in the rain,*. The change then waited in the list for ever. Accept
refused it, since its old words were gone, and only Reject cleared it (F6). A change on words the writer had
rewritten looked ordinary until Accept refused it.

**Now.** When **Changes** opens, each change is tried against its scene as it is (`tryChange`, in `docxImport.ts`).
It is one of three things:
- **It can be made.** Nothing is said. **Accept** makes it.
- **It is already made.** Its new words are where its old ones were, with the words either side (`alreadyMade`).
  It says *Already in the scene: it reads this way now. Clear takes it off the list.* Its button is **Clear**. The
  scene's line counts them: *1 change is already in the scene: Accept all clears it from the list.* Clearing is one
  step of Undo, like an Accept.
- **It cannot be made.** It says why as the list opens, and **Accept** is greyed out.

**A move** is made whole or not at all. Both halves made is made; one half made and not the other is neither.

**The new words somewhere else do not count.** The same words elsewhere in the scene are not this change made, as
they are not its old words found (T7.1).

## T11.2: the letter

Three variants that `t3-letter-splitter.md` did not cover, all in the run's two letters:
- **A heading over a one-line introduction ending in a colon** gave its heading to the introduction. *WHAT MOST
  NEEDS WORK*, *Smaller continuity, quickly* and *SMALL THINGS I'VE CHANGED* were filed as tasks. A heading now
  stays one where the line under it is an introduction, or is not in capitals under one that is.
- **A sign-off with a clause after it** was ticked: *With warm regards, and thanks for a book I was glad to spend a
  week in,*. The name under it became a heading. A sign-off ending in a comma is one whatever its length.
- **An indented table**, the editor's calendar, was one point with its rows run together. Lines set in from the
  margin, after nothing or after more of the same, are one point, a row a line. The dialog and the task show the
  rows as lines.

### Measured on the two letters

| | Proposed then | Proposed now | The writer kept |
|---|---|---|---|
| Letter 1 | 55 | 51 | 35 |
| Letter 2 | 28 | 27 | 9 |

- **Every task the writer kept is proposed**, with the same words.
- **Each is under the same heading but two**, from the second letter: *One sentence I've left to you…* and *And one
  question…*. In the run they were filed under *WHAT THE REVISION OPENED*, because the splitter had lost *SMALL
  THINGS I'VE CHANGED*. They are in that section of the letter, and are now under its heading.
- **The rest are the letters' praise and framing**: *WHAT'S WORKING*, *This is the biggest thing, and it's
  structural.*, *It's a better book than the one you first sent*. The writer unticks those. Nothing in their wording
  tells them from a point to act on.

## T11.3: a note keeps its place when words go into its passage

**What happened.** Five words put into the middle of a nine-word passage left its note unplaced: *folded small [in
its scrap of oilcloth] inside the left one*. The words either side of it stood as they were.

**Now.** In its own scene, where nothing else placed it, a note is placed by its surroundings (`bySurroundings`, in
`noteAnchor.ts`):
- the words before it and the words after it both stand whole, in that order, a scene's start or end standing for
  them where the note had none;
- what is between keeps the passage's words: at most a quarter of them dropped or changed, counted by their letters,
  any number put in;
- it is no more than twice the passage's length;
- between two places as good, it is placed in neither.

It is said to be edited, as a note on a word retyped is. Only for a passage long enough to be edited (16
characters, as the near-match).

**Words, not letters.** First built with the passage's letters kept in order. On the earlier runs' books that
placed a note on *twenty-two thousand crowns* on the writer's *a hundred and forty thousand crowns*: any two phrases
share many letters in order. Counted by whole words, it is unplaced.

**Notes only.** A change is to the words as they stood. Its mark on the Page is not placed this way: it would strike
the writer's own words put in as the editor's.

### Measured on the three runs' books

Each book's notes, placed against its prose at the end of the run:

| Book | Notes | Exact | Edited, before | Edited, now | Unplaced, before | Unplaced, now |
|---|---|---|---|---|---|---|
| Second loop (`writer-run-2026-11-10-loop2.pwk`) | 59 | 48 | 0 | 2 | 11 | 9 |
| First loop (`writer-run-2026-11-10-loop.pwk`) | 61 | 48 | 0 | 0 | 13 | 13 |
| Blind editor run (`writer-run-2026-11-09-blind-editor.pwk`) | 56 | 45 | 1 | 3 | 10 | 8 |

The four now placed, each read against its passage, and each on it:
- *over the letter folded small inside the left one*, on *…folded small in its scrap of oilcloth inside the left
  one*: the run's case;
- *the Pellmouth men have been paid on it*, on *the Pellmouth underwriters have paid on it*;
- *The auditor came two days early.*, on *The auditor came that same afternoon, two days early.*;
- *keep it up in the tower, above the tide-line*, on *keep it up on the old gallery over the nave, above the
  tide-line*.

T7.2's cases are as they were: the note whose words were rewritten is unplaced, and one whose passage moved to
another chapter follows it there.

## T11.4: italics in Changes

In Changes, the text around a change showed `*Heron — 6th —…`. T7.6 said an italic *change*; the surroundings, and a
change's own words, still showed the marks.

**Now** a change's surroundings and its words are shown in italics where the Page has them, without the marks
(`withEmphasis`, in `docxEdits.ts`). They are read as one line: a mark before the change may close after it. The text
cut off before what is shown is read for the marks it opens. A first mark that can only close says the line began
in italics. Inside a word, a mark is a character: *snake_case* keeps its underscore. A change's name, as a screen
reader reads it, has no marks.

## Tests

- **`tryChange.test.ts`**, on the run's files:
  - *four hours in the rain*: it can be made as the book went out, is made as the writer had it by the next round,
    and neither when rewritten again;
  - made means its new words where its old ones were, with their surroundings, not the same words elsewhere; a cut
    is made where the words either side meet;
  - a move, both halves made, and one half taken out by hand;
  - a change with no scene.
- **`editImport.test.ts`**, against the real store: a change already made is cleared, Undo brings it back, and Accept
  all counts it.
- **`editorialLetter.test.ts`**, with the two letters as fixtures and the writer's kept tasks from the run's `.pwk`
  (`letter-tasks-kept.json`):
  - every kept task proposed, with the same words and heading, but for the two now under their own;
  - 51 and 27 proposed;
  - the three headings; the long sign-off, the name and the signature unticked, and the name not a heading;
  - the calendar one point of twelve rows, and the paragraph before it one line.
  T3's tests are unchanged and pass.
- **`noteAnchor.test.ts`:**
  - the oilcloth note, on the run's sentence, placed by its surroundings;
  - unplaced where what is between is rewritten, more than twice as long, or the words after it are gone;
  - its exact words in another scene are followed, and its surroundings in another scene are not;
  - a rewrite between surroundings that stand, sharing letters but not words, is unplaced; words put in are placed;
  - two places as good, neither; one, there; the scene's start standing for the words before;
  - a change, strict or for its mark, is not placed this way.
  T7.2's tests are unchanged and pass.
- **`withEmphasis.test.ts`:** the run's sentence, cut as Changes cuts it; a stretch cut inside italics; the text cut
  off read for its marks; underscores; a `_` inside a star's italics; marks inside words and between spaces; empty
  pieces.
- **`wordRoundTrip.spec.ts`**, in the app:
  - **T11.1:** one change made by hand and one rewritten. As the list opens, the first says it is already made,
    with **Clear** and no Accept; the second says why it cannot be made, with Accept greyed out. The scenes' lines
    and Accept all say the same. Clear takes it off and leaves the prose. The words put back, the other is made.
  - **T11.3:** a change marked on the Page; the writer puts words into its passage; the mark is gone, and Changes
    says why.
  - **T11.4:** the run's sentence, with *the* put into its italics: the surroundings and the change in italics,
    with no `*` shown or in the name. A word changed for one in italics: the new word in italics, its name without
    marks. Accepted, the prose has its marks.
- **`revisionTasks.spec.ts`:** the first letter pasted. The three headings, the sign-off unticked, *51 tasks to add,
  of 56 points*. The calendar shown as twelve lines in the dialog and in the task.

**Mutants**, gated on `tsc && eslint && echo MUTANT-OK && grep`. MUTANTS

## Not done here

- **The letters still propose more than the writer keeps**: 16 and 18 more. They are the letters' praise and
  framing, which read like points.
- **A table's columns** are not kept aligned: each row's spaces are one space.
- **A note placed by its surroundings in another scene** is not: a near-match there is another sentence (T7.2).
