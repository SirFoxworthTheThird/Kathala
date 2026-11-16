# T9.1: a comment with no range is read

**Plan:** `round-trip-plan-3.md`, T9.1.
**Finding:** the third of `loop-2026-11-12.md`, found there by the counts: round 2's returned file held 84 comments and
the import's plan saw 77; round 3's held 102, and the plan saw 86.

## The measure, first (`npm run probe:marked`, LibreOffice 24.2)

The plan asked what LibreOffice writes for a comment an editor makes with nothing selected. `scripts/lo-comment.py`
makes one in the second loop's first file, and one on words beside it.

| The comment | In the file LibreOffice saves | Read by the app, before |
|---|---|---|
| On *with his watch open*, selected | a range's start and end, and a reference | read, on those words |
| With the cursor before *with*, nothing selected | **a reference alone** | **not read** |

- **Word gives every comment a range.** One made with nothing selected is put on the word at the cursor.
- **LibreOffice does not.** It saves such a comment as where it is referred to, and nothing else. It does the same to
  a comment it *reads* on no words, which is what the marked export writes for a thread whose words were rewritten.
- **The app's reader placed a comment by its range's marks only.** So it never read either kind.

**What that had cost:**
- **In the run, nothing.** The 5 threads of round 2 and the 10 of round 3 that were not read were already notes
  in the book, and the editor replied to none of them.
- **Outside it, unknown.** Any comment made in LibreOffice without selecting has been dropped, with no word said.
  The count in *Edits brought in* was of the comments read, so it could not show one missing.

## What changed

- **The reader** (`docxRead.ts`). A comment referred to in the text, with no range anywhere in the file, is a
  comment at that point: on no words, where the reference stands. One with its range is read by the range, as
  before, and not twice.
- **The planner** (`docxImport.ts`) already put a comment on no words onto the word it stands before. After a
  scene's last word there is none, and the comment was dropped: it now takes the last word.
- **Nothing else.** A thread coming back is matched to its note by its words and author, as T5.3 does it, wherever
  it now stands. So a thread at a scene's start is added to, and resolved, like any other.

## The run's files, now

| | Comments in the file | Threads read | Replies read | Of the threads, on words since rewritten |
|---|---|---|---|---|
| Round 1 back | 39 | 38, and 1 on a heading | 0 | — |
| Round 2 back, before | 84 | 48 | 29 | 0 |
| **Round 2 back, now** | 84 | **53** | **31** | **5** |
| Round 3 back, before | 102 | 49 | 37 | 0 |
| **Round 3 back, now** | 102 | **59** | **43** | **10** |

Every comment in each file is read. Round 1 is as it was: every comment in it had its range.

## Tests

- **`docxPointComments.test.ts`:**
  - **LibreOffice's own file** (`libreoffice-point-comment.docx`, made by the script): a reference alone in the
    file; read as a comment on no words, just before *with his watch open*; brought in as a note on *with*, with
    the words around it.
  - **The run's three files:** the table above.
  - **The reader's marks:** a reference alone is a comment at that point; one with its range is not read twice;
    two in a paragraph each stand where they were made, beside one with a range.
  - **Where it lands:** at a scene's start, on the first word; at a paragraph's end, before the next one's first
    word; after the scene's last word, on that word.
- **`editImport.test.ts`:** a thread that comes back as a reference alone is still its note. The editor's reply is
  added under the writer's, it is resolved, and no second note is made.
- **`wordRoundTrip.spec.ts`**, in the app: a file with one comment on its words and one at a point. *2 comments are
  now notes*; the second is on *belonged*, the word after the point, and marked on the Page.

**Mutants**, gated on `tsc && eslint && echo MUTANT-OK && grep`. All 7 were killed:
- the reader: a reference alone not read, by the unit tests and again by the e2e; a ranged comment read twice; the
  references taken first to last, which misplaces a second one; every reference at its paragraph's start; the end
  written before the start;
- the planner: nothing done after the last word.

**The guide** says where a comment made with nothing selected lands.

## Not done here

- **A note on one word is a weak anchor.** *with* is in the scene many times. The words either side are kept with
  it, and the note is placed by them, but a rewrite of that sentence will unplace it sooner than a note on a phrase.
  Word's own choice is the same single word.
- **A comment at a point on a heading or the title page** is counted with the comments outside the scenes, as one
  with a range is. Sending those back is T9.4.
- **The app's line** *On words since rewritten* still stands in the editor's comment. That is T9.2.
