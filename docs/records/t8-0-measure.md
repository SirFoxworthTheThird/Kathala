# T8.0: the marked file, measured before any change

**Plan:** `round-trip-plan-3.md`, T8.0.
**Finding:** the first and fourth of `loop-2026-11-12.md`: the editor could not read a marked revision where the writer
had rewritten, and LibreOffice's reject-all left empty paragraphs.

Nothing in the app changes here. This part remakes the run's two marked files, writes down what they cost as tests,
and finds which form of a mark LibreOffice trips on. T8.1 to T8.4 are measured against it.

## The two files, remade

The drafts each marked file was made from are now fixtures, taken from the run's `.pwk`
(`fixtures/docx/run-2026-11-12-loop2/draft-*.json`):

| Fixture | The draft |
|---|---|
| `draft-sent-1` | The book as first sent |
| `draft-back-1` | As the editor sent it back, round 1 |
| `draft-marked-2` | The book as it went out marked, round 2 |
| `draft-back-2` | As the editor sent it back, round 2 |
| `draft-marked-3` | The book as it went out marked, round 3 |

**They make the files the run sent.** Marking `draft-marked-2` against `draft-back-1`, and `draft-marked-3` against
`draft-back-2`, gives the marks of `round2-from-writer.docx` and `round3-from-writer.docx` in 16 of 16 scenes each:
every paragraph, every stretch put in or taken out, every paragraph mark. So the fault is reproduced from the fixtures
alone, and a fix can be measured on them.

## What the files cost, in numbers (`markedRunFiles.test.ts`)

| | Round 2 | Round 3 |
|---|---|---|
| The most marks in one paragraph | **112** | **94** |
| The next four | 35, 15, 13, 9 | 39, 20, 18, 10 |
| What the dialog said: *N changes* | **160** | **134** |
| The same difference, as bringing a file in counts it (`hunks`) | **49** | **42** |
| Stretches put in, and taken out | 156 and 110 | 130 and 112 |
| Paragraphs put in whole, and taken out whole | 16 and 0 | 3 and 1 |
| Paragraphs displaced | **2** | **2** |

- **The editor counted 113 and 95** in the files. A stretch cut in two by a comment's mark is two there and one here.
- **The dialog's count is three times the import's.** The writer counted about 82 and 52 by eye, and the editor
  about 30 in the first. 49 and 42 are what the app itself would say of the same two texts on the way in.
- **Displaced** means a paragraph put in whole, or taken out whole, though one much like it stands on the other side of
  the same scene. These are the paragraphs the writer barely touched and the editor saw as new:
  - round 2: *There was a message waiting for her at the door…* and *Then she held out the warehouseman's book…*;
  - round 3: *She was halfway through the second when…* and *They went in at slack water on the top of the tide…*.

### How alike the paired paragraphs are

Likeness here is the two paragraphs' words in common, as a bag, over the longer. It is a measure for this record and
its test, not the one T8.1 has to use.

| Likeness | Under 0.1 | 0.1 | 0.2 | 0.3 | 0.4 | 0.5 | 0.6 | 0.7 | 0.8 | 0.9 and over |
|---|---|---|---|---|---|---|---|---|---|---|
| Round 2: paragraphs paired and compared (28) | 1 | 1 | 0 | 1 | 0 | 1 | 2 | 5 | 8 | 9 |
| Round 2: put in whole, against their nearest (16) | 0 | 1 | 7 | 5 | 1 | 0 | 1 | 1 | 0 | 0 |
| Round 3: paired and compared (20) | 1 | 0 | 1 | 0 | 0 | 1 | 0 | 6 | 5 | 6 |
| Round 3: put in whole (3), taken out whole (1) | 0 | 0 | 1 | 1 | 0 | 0 | 0 | 0 | 0 | 2 |

What it shows, for T8.1:
- **Four pairs are wrong**, two in each file, at 0.10, 0.30, 0.05 and 0.29. They are the 112-mark and 94-mark
  paragraphs and their fellows.
- **One low pair is right**: *So he knew that too.* against the same sentence with three more after it, at 0.17. The
  short paragraph is whole inside the long one. A measure over the longer of the two calls that unlike, so T8.1's
  measure has to see containment.
- **A truly new paragraph scores 0.1 to 0.5** against its nearest neighbour, on common words alone. The displaced ones
  score 0.61 to 0.99. A bag of words leaves little room between them. T8.1 should measure words in order.

## LibreOffice's own reject-all and accept-all (`npm run probe:marked`)

The probe so far saved a marked file through LibreOffice and read it back with the app's reader. That never showed
the empty paragraphs. The editor's own check did: reject every change in LibreOffice and compare the text.

The probe now does the same, with `scripts/lo-views.py`. For each case it makes three files with the export: the
base, the book, and the book marked against the base. LibreOffice's text of the marked file with every change rejected
is compared with its text of the base, and accepted with the book.

**Run on LibreOffice 24.2.** Accepted is the book in every case. Rejected:

| Case | Rejected is the base |
|---|---|
| The run's round 2, remade, without its threads | yes |
| The run's round 3, remade, without its threads | yes |
| **The run's round 2, as sent** | **no: 2 empty paragraphs** |
| **The run's round 3, as sent** | **no: 1 empty paragraph** |
| A new paragraph after an unchanged one | yes |
| A new paragraph after a changed one | yes |
| A new paragraph at a scene's start | yes |
| A new paragraph at a scene's end | yes |
| Two new paragraphs after an unchanged one | yes |
| A new paragraph at a scene's end, before another scene | yes |
| A new paragraph at a scene's end, before another chapter | yes |
| A paragraph taken out | yes |
| A thread on a paragraph, and nothing new | yes |
| **A new paragraph after one with a thread in its middle** | **no: 1 empty paragraph** |
| **A new paragraph after one with a thread at its end** | **no: 1 empty paragraph** |
| **A new paragraph after one with a thread, itself changed** | **no: 1 empty paragraph** |
| **Two new paragraphs after one with a thread** | **no: 1 empty paragraph** |
| A new paragraph before one with a thread | yes |
| A new paragraph with a thread on its own words | yes |
| A paragraph taken out after one with a thread | yes |
| A new paragraph after one with a thread, **the mark on the new paragraph itself** | **yes** |

**What it is.** A new paragraph after a paragraph that carries a comment. Wherever the comment sits in that
paragraph, LibreOffice's reject-all takes the new paragraph's words and leaves its break.
- It accounts for every one the editor saw. Counted in the files as sent:
  - round 2 puts new paragraphs after a standing one in 8 places, 2 of them after a commented paragraph: 2 empty;
  - round 3 does so in 2 places, 1 of them after a commented paragraph: 1 empty.
- `loop-2026-11-12.md` guessed *a paragraph with no change of its own*. That was a coincidence, and the case
  *a new paragraph after one with a thread, itself changed* shows it.
- The text is otherwise the base, line for line, in both of the run's files.

**The last row is the lead for T8.4.** The form T5.1 chose marks the break of the paragraph *before* the new one, as
Word does. With the mark on the new paragraph's own break, LibreOffice's reject-all gives the base. T5.1 left that form
because LibreOffice, saving it, wrote both breaks as inserted, and the app's reader then joined two of the editor's
paragraphs. So neither form is safe everywhere, and T8.4 has to choose by case: this probe now measures both ways of
going wrong.

## Tests

- **`markedRunFiles.test.ts`:**
  - the fixtures' drafts make the run's two files, mark for mark, in every scene;
  - the numbers above: most marks in a paragraph, the dialog's count, the import's count, the displaced paragraphs.
  - **Three tests marked as failing**, which is what T8 is for. Each fails today and goes red the day it passes:
    - T8.1: a new paragraph before one barely changed is one insertion, and the changed one keeps its words;
    - T8.1: in the run's files, no paragraph is put in or taken out whole while one like it stands on the other side;
    - T8.3: the dialog's count is what bringing the file in would say.
- **A mutant, to see the first test can fail:** the break before a new paragraph left unmarked. It was killed.
- **The full unit suite passed**, and no e2e was run: nothing a spec reads has changed.

## What it leaves for the parts after it

- **T8.1:** a measure of likeness that sees words in order and one paragraph inside another. The floor and the
  ceiling are the table above.
- **T8.2:** the next-most-marked paragraphs, 35 and 39, are rewritten sentences in paragraphs rightly paired. They
  are what is left once the pairing is right.
- **T8.3:** 49 and 42 are the numbers the dialog should say, or what those become once the marks change.
- **T8.4:** the commented paragraph, and the choice of form by case.
