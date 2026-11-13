# T10.1–T10.2: an edit declined says so, and the tally of the editor's changes

**Plan:** `round-trip-plan-3.md`, T10.1 with decision D-7 as taken, and T10.2.
**Findings:** the second of `loop-2026-11-12.md`, and the editor's wish 8. The marked file is measured from the
editor's text (D-4), so an edit the writer declined is a change of the writer's like any other, and reads as new
writing. The second loop's writer turned the *Nessa* sentence back and left it out of the cover note. The editor
could not tell a choice from an accident.

## Three texts

A change that turns an edit back is known only with a third text: the book as it went to the editor. Two were
already on the device, the book as the editor sent it back and the book as it is. Bringing a file in now keeps two
more things with the book as the editor sent it back (`BookDraftRecord`):
- **`wentAs`**: the draft the editor's file was made from;
- **`editorChanges`**: the editor's changes, as bringing the file in counted them. The Changes list cannot be
  asked, because a change is gone from it once decided.

A book brought back before this has neither. For the first, the last book sent before it came back is taken
(`wentDraftOf`). Without the second there is no tally.

## The pieces of a change (`changeItems`)

The rule and the tally rest on one thing. A marked scene is cut into its changes as `changeCount` counts them. For
each change it keeps:
- what it takes out and puts in, each with the paragraph marks that go with it;
- the words kept between it and the change before, and between it and the change after.

A scene's start and end, and each paragraph's, are marks in that text (`scenePlain`). So *the start of a paragraph*
and *the end of the scene* can be asked for.

**Which side a third text has at a change** (`sidesIn`): its change, or what it replaced, or neither, or both. It is
found by the change with the words kept either side, at most 40 characters. One side found and not the other is the
answer; both is none. Neither, and it is asked again within the change's own paragraph: the words kept may run into
the paragraph before, and an edit there the writer took is not in the scene as it went. Where the words kept before
are fewer than 40, they run back through the change before, read as that change was found.

## T10.1: the changes that turn an edit back (`markDeclined`)

A change of the writer's turns an edit back where the book as it went has the writer's side at its place, and not
the editor's.
- **A paragraph the editor cut, put back, does.** So does one they wrote, taken out, and one they joined to the
  last, put apart again.
- **A paragraph the editor only changed, taken out, does not:** that is the writer's own cut.
- **Part of an edit put back is new writing.** The editor's *twice slowly* made *once*, and the writer's *once
  slowly*, is the writer's.

**Signed with a second name (D-7):** the byline and *(edit declined)*, as *Elin Ashgrove (edit declined)*. That
covers its words, and the paragraph mark of a paragraph put back whole (`breakDeclined`). Every word processor
colours changes by name and lists and filters by it.

**Coming back, both names are the writer's** (`isWriters`, in `withChangesMade`). A marked file brought back as
it went is nothing to decide.

**The dialog says how many:** *2 changes and 0 comment threads, signed Nell Garrow: … 1 of those puts back what
they changed, signed Nell Garrow (edit declined).*

### Measured on the second loop's files

- **Round 2: 8 edits turned back**, in 9 marks, as the two reports have them. The *Nessa* sentence the writer left
  out of the cover note is among them.
  - One edit is two marks. The editor joined a line of dialogue to the paragraph before. Putting them apart again
    is a change in the paragraph and a paragraph put back.
  - *Heart stopped* is not one of them. The writer rejected it and then rewrote it: *Tamsin, above him in the dust,
    did not breathe.*
- **Round 3: 1, *filed* made *kept* again.** The writer rejected four:
  - the cut of *quite kindly*, then made by hand. The book has the editor's text there, so nothing is marked;
  - a split in chapter 3, fixed another way. The sentence it had moved was taken out;
  - *cramped hand*, rewritten;
  - *filed*.
  These are the writer's own notes: *"filed→kept" shows as mine; "quite kindly" equals her text so shows nothing;
  the other two are inside sentences I rewrote.*

## T10.2: what became of the editor's changes (`editTally`)

**Counted from the three texts.** The editor's text is cut into pieces against the book as it went, and the book as
it is is read at each piece. Each kept change of the editor's is the pieces in its words, or touching them where
either side is no words at all, such as a split, which puts in only a paragraph mark.
- **It stands** where the book has every piece as the editor left it.
- **It was turned back** where the book has every piece as it went.
- **Anything else, it was rewritten since:** some taken and some not, new words in its place, or its scene gone.
- **A move's two halves are one change.**

**The writer's changes since stop the words kept either side** of one of the editor's. Checked against the book as
it is, the writer's *boxes*, right beside the editor's cut of *twice, and*, is not there to find the cut by. The
same was tried for the export's own check, and it changed nothing there that a test could show. An editor's change
close enough to spoil the words kept is joined to the writer's change it is beside. So it is used here only.

**Said for the cover note:** *Of Ines Marlowe's 58 changes: 49 stand, 8 turned back, 1 rewritten since*, under the
option. **Copy for the cover note** puts it on the clipboard. Each part is said only where there is one, and agrees
with its number.

### Measured on the second loop's files, against the writer's own records

| | The dialog said | Stand | Turned back | Rewritten since | The writer's record |
|---|---|---|---|---|---|
| Round 1's file | 58 | 49 | 8 | 1 | 48 accepted, 9 rejected, 1 made by hand |
| Round 2's file | 19 | 17 | 1 | 1 | 15 accepted, 4 rejected, 1 of them then made by hand |

- **Round 1:** the 49 are the 48 accepted and the one made by hand. The 9 rejected are the 8 turned back, and *heart
  stopped*, rejected and then rewritten.
- **Round 2:** the 17 are the 15 accepted and two of the four rejected:
  - *quite kindly*, then made by hand;
  - the split in chapter 3. The writer fixed it by taking out the sentence it had moved, which leaves the editor's
    paragraph break in the book.

  *Cramped hand* was rewritten, and *filed* turned back.

## Tried and not kept

- **Asking again with fewer words kept than the paragraph's**, where neither side was found: 16 characters, then 8,
  with words kept that are only marks and stops ruled out. Each was added for a case in the run's files, while the
  tally's words kept were still read whole. Once they stopped at the writer's changes, every case came out the same
  without them, and a mutant taking any one of them out survived. They were taken out. So was asking within the
  change's own paragraph, for a while: the unit tests passed without it. The e2e did not. The editor's *in the
  rain*, taken, is in the paragraph before the *now* the writer put back, and only within its own paragraph is
  *now* found. It went back in, with a unit test of that case.

- **Reading the words kept as the third text has them**, rather than cutting them short. Checked against the book
  as it went, the editor's *boxes* would be read as the *crates* it was. It broke on the editor's split: that is
  two pieces, a cut in one paragraph and a paragraph after it. Reading the first as it went put the sentence back
  into the words kept, and the writer taking out the second then read as putting the text back. Cutting the words
  kept had none of this and gave both rounds exactly.

## Tests

- **`markedRunFiles.test.ts`**, the second loop's files:
  - **round 2:** the eight edits turned back, in their nine marks, *Nessa* among them and *heart stopped* not. The
    dialog says nine;
  - **round 3:** *filed* alone;
  - **the file:** the declined changes signed with the second name, and with the writer's made it is the book as the
    writer sent it;
  - **the tallies:** 49, 8 and 1 of the 58, and 17, 1 and 1 of the 19, each explained in the test from the writer's
    records.
- **`markedDocx.test.ts`:**
  - **the rule:**
    - a word put back is declined; another word is not; a word changed where the editor changed nothing is not;
      without the text as it went, nothing is;
    - a cut put back, and words added taken out, are declined; part of a cut put back is not;
    - a paragraph cut, put back; one written, taken out; one only changed, taken out, which is not;
    - the paragraph mark that comes with a paragraph put back;
    - a paragraph joined at the scene's end, put apart, and joined another way, which is not;
    - one put back after an edit taken in the paragraph before;
    - where the text as it went has both sides at such a place, nothing; where it has one, it is said;
    - part of one edit put back, which is not, and all of it, which is;
  - **the file:** the second name on the declined change and the byline on the writer's own; without the text as it
    went, the byline on all; a paragraph put back signed so whole, its mark too; `isWriters`; made as the writer, the
    file is the writer's text, and made as another, it is not; the dialog's count;
  - **the tally:** stands, turned back, rewritten, each alone and mixed; a word changed in the same sentence as
    theirs, and one right beside it; a scene gone; a move's halves as one, and one half's scene gone; the line for
    the cover note, in each form.
- **`editImport.test.ts`**, against the real store: bringing a file in keeps the draft it went from and the
  editor's three changes; a sent-back draft without it is given the last book sent before it came back, and not
  one sent after; the plan says 1 declined and 2 stand, 1 turned back; the file signs *had* for *held* as an edit
  declined and *boxes* with the byline; brought back as it went, nothing is to decide.
- **`wordRoundTrip.spec.ts`**, in the app: an insertion taken and a cut declined, and a line of the writer's own.
  The export dialog says *1 of those puts back what they changed, signed Nell Garrow (edit declined).* and
  *Of Ana Editor's 2 changes: 1 stands, 1 turned back.* **Copy for the cover note** puts that on the clipboard;
  unticking the option hides it, and ticking it shows it again. In the file, *now* is put back under the second name
  and *Not once.* under the byline. Brought back as it went: *No changes*, and the prose as it was.
- **`npm run probe:marked`**, LibreOffice 24.2: a word put back and a paragraph put back, each signed so. Rejected
  is the editor's text and accepted the writer's, in LibreOffice and read back by the app. The table is 44 cases
  right, and the 4 meant to be wrong.

**Mutants**, gated on `tsc && eslint && echo MUTANT-OK && grep`. 31 in all; 29 on code that is still there,
every one killed:
- **the rule (8):** never declined; the editor's side counted as declined; no scene marks; no running back through
  a change; no context; a change found on both sides taken as an answer; no asking within the paragraph; a
  paragraph mark not the new paragraph's;
- **the tally (8):** no cuts; a cut at the change itself; a move as two; a move keyed by its scene; only pieces
  wholly inside a change; a scene gone counted as standing; *1 stand*; no tally;
- **the plan, the file and the way back (8):** declined not counted; the text as it went not passed to the file;
  one name for both; not marked; the paragraph mark the byline's; the second name not the writer's; the import
  keeping no changes; the import keeping no draft it went from;
- **the drafts (1):** the last sent after it came back taken;
- **the dialog, by the e2e (4):** no sentence; the text as it went not loaded; Copy copying nothing; the tally shown
  while not marking back.

The other two took out code that then came out for good: asking again with 16 and 8 characters, and the rule
against words kept that are only marks.

**What they found:**
- **Three survived the first run**, all ways of asking again with fewer words kept. They came out of the code.
- **One of those, asking within the paragraph, was needed after all**, and only the e2e showed it (*Tried and not
  kept*, above). It went back in with a unit test, and a mutant taking it out again was killed.
- **Two more survived** and their tests were added: a change found on both sides, and a scene gone.
- **The scene-gone test found a bug.** A move's halves were grouped by scene and move, so a move from one scene to
  another was two changes. A move's id is the file's; it is grouped by that alone.
- **Four did not build as first written**, and were redone in forms that build. All were killed.

## Not done here

- **The split the writer fixed another way counts as standing.** The editor's paragraph break is in the book. The
  sentence it moved is gone, but that sentence is not part of the change as bringing the file in kept it.
- **A paragraph the editor joined, put apart again, is two changes of the writer's**, in the file and in the
  dialog's count of those that put an edit back. It turns one edit back, and the tally counts it as one: the
  tally counts the editor's changes, the dialog the writer's.
- **A book brought back before this part** has no `editorChanges`, so its marked revision has no tally. Its edits
  declined are still signed, from the last book sent before it came back.
