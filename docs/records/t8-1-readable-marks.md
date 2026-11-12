# T8.1–T8.3: a marked file an editor can read

**Plan:** `round-trip-plan-3.md`, T8.1, T8.2 and T8.3.
**Measured against:** `t8-0-measure.md`, on the second loop's two marked revisions.
**Finding:** the first of `loop-2026-11-12.md`. The editor could not read a marked revision where the writer had
rewritten, and needed a script to check it.

All three parts are in `markedDocx.ts`. The file an editor receives changes; nothing a writer does in the app does.

## What changed, in numbers

The same two revisions, marked before and after:

| | Round 2 before | Round 2 now | Round 3 before | Round 3 now |
|---|---|---|---|---|
| Most marks in one paragraph | 112 | **4** | 94 | **6** |
| Most changes in one paragraph | — | **3** | — | **4** |
| Paragraphs displaced | 2 | **0** | 2 | **0** |
| What the dialog says: *N changes* | 160 | **36** | 134 | **31** |
| What bringing the marked file in would say | — | **36** | — | **31** |

- **The editor's own estimate** of round 2 was *about 30 real changes*. The writer counted about 82 and 52 by eye in
  the files as they were.
- **A mark** is a stretch put in or taken out. **A change** counts a stretch taken out with one put in for it once.
- **Rejecting every change gives the editor's text, and accepting every one the writer's**, in 16 of 16 scenes of
  both, read back by the app's reader. The first loop's revision is still 13 of 13.

**The paragraph that had 112 marks** now reads as what the writer did. The paragraph was split and its opening
rewritten:
- the new opening, *She went down. She was not calm. She was counting…*, is one paragraph put in;
- the old paragraph is compared with the one that kept its words. Its opening is struck once and *Then she* put in,
  and the rest, *held out the warehouseman's book…*, stands unmarked.

## T8.1: which paragraph is compared with which (`likeness`, `paired`)

Paragraphs the same in both texts are found first, as before. Those between them were paired in order, first with
first. They are now paired by likeness, in order, so that the pairs taken together are as alike as they can be. One
with no like on the other side is put in whole or taken out whole.

**Two paragraphs are alike when either holds:**
- **half of the longer one's words are in the other, in order;**
- or **four fifths of the shorter one's words are in the longer, in order, with an unbroken run of them**: six
  words, or the whole of a shorter paragraph, and never fewer than three.

**Where the numbers come from.** Every pair of changed paragraphs in a scene was measured, in both loops' files: 117
and 56 pairs in the second loop's two revisions, 887 in the first loop's.

| Words in common, in order, over the longer | Under 0.1 | 0.1 | 0.2 | 0.3 | 0.4 | 0.5 | 0.6 | 0.7 | 0.8 | 0.9 and over |
|---|---|---|---|---|---|---|---|---|---|---|
| Second loop, round 2 (117) | 49 | 36 | 5 | 0 | 0 | 1 | 3 | 6 | 8 | 9 |
| Second loop, round 3 (56) | 9 | 26 | 1 | 0 | 0 | 1 | 0 | 7 | 5 | 7 |
| First loop (887) | 447 | 337 | 14 | 7 | 4 | 4 | 5 | 5 | 15 | 49 |

- **The second loop's files fall in two heaps**, with nothing between 0.3 and 0.5.
- **The first loop's do not.** Read one by one, the pairs between 0.3 and 0.5 are paragraphs rewritten by more than
  half, or with a part moved to another. Compared word by word they would be marks more than text; taken out whole
  and put in whole they are readable. So the line is at a half.
- **The highest pair that was plainly not the same paragraph** scored 0.27: two fifteen-word lines sharing four
  small words.
- **One kept inside another scores low on that measure and is plainly a pair:**
  - *So he knew that too.*, with three sentences added after it: 0.17;
  - *"Hale," he said.*, with a sentence added: 0.33;
  - a paragraph cut from 57 words to its first 20: 0.32.
- **The run is what makes the second rule safe.** A five-word line, *"And the Gannet?" said Corin.*, finds four of
  its five words, in order, in a 113-word paragraph it has nothing to do with. No three of them are together there.

Most pairs never reach the comparison in order. The words two paragraphs share whatever their order are counted
first, which is quick, and no more can be shared in order.

## T8.2: a phrase rewritten is one stretch out and one in (`pairRuns`)

Once the pairing was right, most of the word-by-word marking had gone with it: the worst paragraph fell from 112
marks to a handful before anything else was done. What was left is drawn together by one rule.

- **A change** is a run of words out and in with at most spaces kept between, as bringing a file in already counts
  it.
- **Two changes with one or two words kept between them, in one sentence, are one.** *had burnt off at noon* made
  *was burning off as he spoke* is that, not two changes either side of *off*.
- **What the two sides of a change share at either end, in whole words, stays unmarked** (`shownChange`, which
  the Changes dialog uses). *twice* made *twice, slowly,* puts in *, slowly,* and strikes nothing.

**The number of words is measured.** The dialog's count on the two revisions, by how many kept words still join two
changes:

| Words kept between | 0 | 1 | **2** | 3 | 4 |
|---|---|---|---|---|---|
| Round 2 | 44 | 38 | **36** | 36 | 36 |
| Round 3 | 41 | 35 | **31** | 27 | 25 |
| Most changes in one paragraph | 3 and 5 | 3 and 4 | **3 and 4** | 3 and 4 | 3 and 3 |

At two, a phrase reads as a phrase. At three and four, round 3 goes on falling: changes that a reader would call
separate are being run together. *The old wall stood by the north gate* made *The ancient wall stood by the south
gate*, three words between, stays two changes.

**Not done, and why.** The plan also had a sentence with several changes marked whole. On these files it changed
nothing once the rule above was in, and it would turn three small corrections in one long sentence into the whole
sentence struck. It was written, measured and taken out.

## T8.3: the count (`changeCount`)

The dialog counted every stretch. It now counts a change as a reader does: each run of words and paragraph breaks
put in or taken out with nothing kept inside it.
- A word replaced is one.
- Two paragraphs put in one after another are one. So is a paragraph taken out with another put in its place.
- A paragraph put in whole takes its own break with it, whichever break the file marks for it.

**It is what bringing the file in would say.** For both revisions the marked file was read back and planned as an
import against its base. The plan's count of tracked changes is the dialog's, in every one of the 32 scenes, with no
edit found with tracking off.

That took two tries, and the test found both misses. Counting only the break the file marks was one over in one
scene; counting only a whole paragraph's own break was two over in two others.

## LibreOffice (`npm run probe:marked`, LibreOffice 24.2)

- The two revisions, marked as now: every change rejected is the base, and accepted is the book.
- The first loop's revision, saved through LibreOffice and read back: 13 of 13 both ways.
- **The empty paragraph after a commented one is as it was.** That is T8.4, and nothing here touches it.

## Tests

- **`markedDocx.test.ts`:**
  - **Which paragraph is compared with which:** half its words in order; one kept inside another; a short line not
    paired with a long paragraph that merely has its words; a new paragraph before one barely changed; a paragraph
    split in two, and one replaced.
  - **A change as a reader counts it:** two changes a word or two apart are one, further apart or in two sentences
    two; shared ends kept; the count's cases.
- **`markedRunFiles.test.ts`**, on the two revisions: the reader's test in 16 of 16 scenes each; nothing displaced;
  the paragraph that came back as new, compared with the one it was; the most changes in a paragraph; the dialog's
  count against the import's, scene by scene.
  - T8.0's three tests marked as failing are plain tests now. Its *mark for mark* test has given way to the
    reader's, as it said it would.
- **`wordRoundTrip.spec.ts`** is unchanged and passes: its marked revision is one line put in.

**Mutants**, gated on `tsc && eslint && echo MUTANT-OK && grep`. All 16 were killed:
- likeness: anything pairs; nothing changed pairs; one inside another never; no run asked; the quick count ending
  too soon;
- pairing: the first like taken, not the best; in order, as before; put in before taken out;
- drawing together: never; always; across a sentence's end; shared ends marked;
- the count: breaks not counted; only the marked break; only a whole paragraph's own; every stretch.

Five of them did not build at first, on an unused name or a comparison TypeScript could see was empty. They were
redone in forms that build.

## Not done here

- **A paragraph rewritten by more than half** is taken out whole and put in whole. An editor sees that it was
  rewritten, and not which words survived.
- **Text moved from one paragraph to another** is struck in one and put in the other. It is not marked as a move.
- **Two changes either side of a space but in two sentences** are one, as bringing in counts them: *late. She* made
  *early. He*.
- **The empty paragraph in LibreOffice's reject-all**, and the title page's count: T8.4.
