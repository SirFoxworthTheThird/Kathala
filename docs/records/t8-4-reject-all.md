# T8.4: rejecting every change gives the editor's file, in LibreOffice too

**Plan:** `round-trip-plan-3.md`, T8.4.
**Finding:** the fourth of `loop-2026-11-12.md`, the editor's E-6. LibreOffice's reject-all left two empty paragraphs
in round 2's marked file and one in round 3's, and the title page's word count changed without a mark.
**Measured first in:** `t8-0-measure.md`, which found that the empty paragraph follows a paragraph with a comment in it.

## Two forms of one mark, and where each goes wrong

A new paragraph is one insertion: its words, and a paragraph break. The break can be marked in two places, and the
text reads the same either way:
- **Word's form:** the break of the paragraph *before* is marked, and the new paragraph ends with the break that was
  there. This is what Word writes when a paragraph is typed after another. T5.1 chose it.
- **Its own break:** the paragraph before is left alone, and the new paragraph's own break is marked.

Each was written by hand for every case, and read three ways: by LibreOffice's reject-all and accept-all on the file as
made; by the same after LibreOffice has saved it; and by the app's reader after that save.

| The paragraph before the new one | Word's form | Its own break |
|---|---|---|
| Unchanged, no comment | right | right |
| Ends in words taken out, no comment | right | right |
| **Ends in words put in**, no comment | right | **wrong: two paragraphs joined** |
| **Has a comment**, unchanged | **wrong: an empty paragraph** | right |
| **Has a comment**, ends in words taken out | **wrong: an empty paragraph** | right |
| Has a comment **and ends in words put in** | right | **wrong: two paragraphs joined** |

- **"Wrong" is LibreOffice's reject-all.** Accept-all was right in every case, in both forms.
- **With its own break after words put in**, the app's own reader also reads the rejected text wrong once LibreOffice
  has saved the file. That is what T5.1 saw in the first loop's book, and why it took Word's form.
- **The whole revisions say the same.** With its own break everywhere, round 2 loses a line: the paragraph whose last
  sentence the writer made a paragraph of its own, which then ends in *round:*, put in.
- **No row is wrong in both columns.** A comment and an ending in words put in together are right in Word's form.

## What the export does now (`settleBreaks`, called from `compileDocx`)

- **Word's form everywhere**, as before, but for one case.
- **The new paragraph's own break** where the paragraph before holds a comment and does not end in words put in.
  With several new paragraphs, each carries its own.
- The choice is made in the export, after the threads are placed, since only there is it known which paragraph
  holds a comment. A thread at a scene's start, on words since rewritten, counts as one in the scene's first
  paragraph.

## The title page's count

- **What happened.** The count is the app's own text, made afresh at each export. *about 12,400 words* became *about
  13,400 words* with no mark, so rejecting every change did not give the editor back the file they had sent.
- **Where the old count comes from.** It is read from the editor's file as it is brought in (`titlePageCount`): the
  words after the tab on the title page's first line. It is kept on the draft *As … sent it back*
  (`BookDraftRecord.titleCount`). It is what that file says, not a count made again from the text.
- **What the marked file writes.** Where the count now differs, the old one struck and the new one put in, signed as
  the writer's other changes are. Where it is the same, or the editor's file had no title page, the line is plain.
- **Coming back,** the writer's own changes are made first, as all of them are, so the count is no change to decide.

## Through LibreOffice (`npm run probe:marked`, LibreOffice 24.2)

The probe's third test now makes 29 cases with the export, and reads each three ways.

| | Cases | Rejected is the base, accepted is the book | Saved by LibreOffice, read by the app |
|---|---|---|---|
| The run's two revisions, remade | 2 | yes | yes |
| The same, with a thread on every paragraph a new one follows | 2 | yes | yes |
| A new paragraph, or one taken out, without a thread | 8 | yes | yes |
| With a thread: before, after, on the new paragraph, on words since rewritten | 9 | yes | yes |
| The paragraph before ending in a change, with a thread and without | 7 | yes | yes |
| A submission whose count has changed | 1 | yes | yes |

- **Read by the app** means three things: rejected is the base, accepted is the book, and with the writer's own
  changes made it is the book, which is how a marked file is read coming back.
- **The title page, by LibreOffice:** rejected, its first line is *Elin Ashgrove, about 1,200 words*, the base's.
  Accepted, *about 1,300 words*, the book's.

**Four rows are wrong on purpose**, and stay in the table so that the reason for the rule can be run again:

| Case | What LibreOffice's reject-all gives |
|---|---|
| The run's round 2, as it was sent | 2 empty paragraphs |
| The run's round 3, as it was sent | 1 empty paragraph |
| Word's form forced after a paragraph with a thread | 1 empty paragraph |
| Its own break forced after a paragraph ending in words put in | two paragraphs joined; and the app, after a save, reads the rejected text wrong |

## Tests

CI has no LibreOffice. The unit tests hold which form is written, and the probe holds what LibreOffice does with each.

- **`markedDocx.test.ts`:**
  - **`settleBreaks`:** the mark on the new paragraph's own break after a commented paragraph, and on the last of
    several; Word's form with no comment, or a comment elsewhere; Word's form where the paragraph before ends in
    words put in; its own break where it ends in words taken out.
  - **The file:** the commented paragraph's break is plain and the new one's marked, and the reverse without the
    comment. Read back, rejected is the editor's text and accepted the writer's, both ways.
  - **The count:** changed, it is the old count out and the new one in, signed; made, it is no change; the same, or
    not known, the line has no mark; read from the run's two files (*about 12,400 words*, *about 13,400 words*), and
    null for a file with no title page; handed from the plan to the file.
- **`editImport.test.ts`:** a file with a title page keeps its count on the sent-back draft; one without keeps none.
- **`wordRoundTrip.spec.ts`**, in the app: a submission sent with nothing marked; brought back; 150 words added on
  the Page; sent back marked, with *about 100 words* struck and *about 200 words* put in, signed with the byline.

**Mutants**, gated on `tsc && eslint && echo MUTANT-OK && grep`. All 12 were killed:
- the break: its own everywhere; after words put in too; the first of several marked, not the last; both marked;
  not settled by the export; every paragraph taken for commented;
- the count: never marked; marked though the same; the name read for the count; not kept on the way in; not given to
  the file; not handed on by the dialog (by the e2e).

Two things about them:
- **One survived at first.** A count marked though it had not changed passed, because the test compared the line's
  text each way, which is the same. The test now looks for the mark itself.
- **One did not build at first**, and was redone.

## Not done here

- **Word was not run.** Both forms are valid in the file format, and Word's own is the one written wherever
  LibreOffice allows it. What Word does with the other, in the one case it is used, is for the next loop or a person
  with Word to say.
- **Other versions of LibreOffice** were not run. The rule is fitted to what 24.2 does with these forms.
- **A count the editor changed by hand** on the title page comes in as a change outside the scenes, as before, and
  is what the next marked file is measured from.
