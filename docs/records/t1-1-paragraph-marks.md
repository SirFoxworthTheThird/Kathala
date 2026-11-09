# T1.1: paragraph marks, and changes that touch

**Plan:** `round-trip-plan.md`, T1.1.
**Finding:** RT-1 in `writer-run-2026-11-09-blind-editor.md`, and E-4 in `editor-run-2026-11-09.md`.

## What was wrong

The editor split three paragraphs with Track Changes on. LibreOffice writes a split as two tracked changes:
- the paragraph's own mark inserted, inside its properties (`w:pPr/w:rPr/w:ins`);
- the space before the break deleted.

`docxRead.ts` read a paragraph's properties only for its style, so the inserted mark was never seen.

**How the split came in.** Both views of the file — every change rejected ("original") and every change accepted
("edited") — already had the break. So:
- the tracked comparison found only the deleted space: "time. " → "time.";
- the comparison against the draft found the break, as an edit made with tracking off: "time. " → "time. ¶".

**What that cost the writer.** Two changes on one gap, both labelled "time. → time.".
- Accepting the tracked one first left "time.At the edge" in the scene.
- The other then could not find its words, and told the writer they had changed them.
- That scene's **Accept all 1** did nothing, without saying so.

On the run's round-1 file the app reported 85 changes, "3 made with tracking off". The editor had made none with
tracking off.

## What was done

**The mark is read** (`docxRead.ts`). A paragraph carries its mark's revision, inserted or deleted, and who made
it. A moved mark counts as inserted or deleted, as moved text does.

**Each view joins paragraphs by their marks** (`joined`, `docxEdits.ts`).
- With every change rejected, a paragraph whose mark was inserted runs on into the next. That paragraph and the
  next were one before the split.
- With every change accepted, a paragraph whose mark was deleted runs on into the next. That is two paragraphs
  joined.
- A paragraph with no words in one view is not there in it. It passes its own mark on, so a paragraph cut with the
  mark before it leaves the paragraphs either side apart.

The split is then one tracked change ("time. " → "time.\n\n"), and nothing is left for the comparison with the draft
to find.

**Said as what it is.** `breakChange` tells a change of whitespace alone that adds or removes a break.
- On the Page it is a green **¶**, or **⌒** for a join, titled *Ana Editor: a new paragraph here*.
- In **Changes** it is **¶ New paragraph** between the words either side, and its accessible name is *Tracked
  change: a new paragraph after "left before dawn."*.
- A break inside a change of words is shown as ¶ too (`showBreaks`), which a space or a line end would hide.

**Changes that touch are one change** (`oneChangePerGap`, `docxImport.ts`).
- Edits made with tracking off are found from the draft to the file with every change rejected. Tracked changes
  are found from there to the file as it reads. The two comparisons meet in the middle text.
- `locatedHunks` gives every change its place in both texts. Where an untracked edit's new words and a tracked
  change's old ones overlap or touch there, they become one change, from the scene as it went out to the file as
  it reads, listed as tracked.
- Nothing in the run's files needs this now the mark is read. It is there for an editor who changes a word with
  tracking off and then, tracking on, changes the words beside it.

**A change that would run sentences together is refused** (`acceptSuggestion`, with `runTogether`).
- The test is whether the scene, made, would have more places where a sentence ends against a capital with no space
  ("time.At", "Go.”She") than the change itself brings.
- An abbreviation in capitals ("U.S.") is not counted.
- `acceptSuggestion` now says why it did not make a change: `gone` or `runs-together`. Both are shown on the change.

**Accept all says what it could not do.**
- It makes what it can and returns each change it could not make, with why. The scene says *N changes could not be
  made, and are left for you*.
- With none left that it can make, the button reads **Accept all 0** and is disabled, and the scene says *This
  change could not be made. Make it by hand, or reject it.*

## Measured

On the run's files (`fixtures/docx/run-2026-11-09/`, with the drafts each was made from, taken from the run's `.pwk`):

| | Before | After |
|---|---|---|
| Round 1: untracked edits found | 3 (the splits) | **0** |
| Round 1: tracked changes | 82 | 82 |
| Round 1: the splits | 3 tracked + 3 untracked, each pair "time. → time." | 3 tracked, each a new paragraph |
| Round 2: untracked edits found | 0 | 0 |
| A scene's changes accepted in either order give the file's text | no: "time.At" one way | **yes**, every scene, both rounds |

The last row is the test that matters (`docxRunFiles.test.ts`). For every scene in both of the editor's files,
every change is accepted in the file's order and then in reverse, starting from the scene as it went out. Both
must give exactly the scene as her file reads, with no sentence run into the next.

The tracked count is still 82 where the editor made 67 edits. Replacements split into words, and moves split into
halves. Those are T1.3 and T1.2.

## Tests

- **`docxRead.test.ts`:**
  - an inserted mark (one change for the split);
  - a deleted mark (a join);
  - a paragraph cut with the mark before it;
  - a mark as the only change, which still names its author.
- **`docxRunFiles.test.ts`:**
  - the run's two files: counts, the three splits, and every scene accepted in either order;
  - two changes touching made one, and two apart left apart;
  - `breakChange`, `showBreaks` and `runTogether`.
- **`editImport.test.ts`:** a change that would run sentences together is refused, kept, and the scene unchanged;
  the one beside it is made. Accept all returns what it could not make, and why.
- **`e2e/wordRoundTrip.spec.ts`:**
  - a split written as LibreOffice writes it is one change. The summary counts only the real edit made with tracking
    off. The ¶ is on the Page with its title, the change is named as a new paragraph in Changes, and accepting it
    breaks the paragraph.
  - Accept all is enabled while a change can be made, and disabled, with the scene saying why, once none can (in the
    existing test of a passage placed by the writer).

**Mutants**, each gated on `tsc && eslint && echo MUTANT-OK && grep` (scratchpad `t11/mutants.py`). All ten were
killed:
- the mark unread;
- marks not joining paragraphs (redone once, after the first form did not build);
- an emptied paragraph skipped instead of passing its mark on;
- the mark's author dropped;
- touching changes never grouped;
- the run-together guard off;
- `breakChange` reversed;
- Accept all never disabled (e2e);
- the dialog's break unlabelled (e2e);
- the Page's break unmarked (e2e).

The whole unit suite passes: 306 files, 3,442 tests.

## Not done here

- **One replacement split into word-level changes (RT-3)** and **a move split in two (RT-2)** are T1.2 and T1.3.
- **The run-together guard can refuse a change the writer wants.** For example, an editor who writes "e.g.Then" on
  purpose. The writer then makes it by hand, as with any refused change. No such change was in the run's files.
