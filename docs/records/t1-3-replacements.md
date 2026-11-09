# T1.3–T1.6: replacements, the title page, restyled breaks, bookmarks

**Plan:** `round-trip-plan.md`, T1.3 to T1.6, which go out together as the plan's table has them.
**Findings:**
- RT-3 and RT-4 in `writer-run-2026-11-09-blind-editor.md`;
- E-1, E-3 and E-5 in `editor-run-2026-11-09.md`.

## T1.3: a replacement is one change

**What was wrong.** Tracked changes were found by comparing the file's two readings word by word. A deletion of "in
his hand" beside the insertion of "under his seal" came in as two changes, `in → under` and `hand → seal`, with
"his" in common between them.
- Accepting one alone left "a letter under his hand", which nobody wrote.
- The app counted 85 changes in round 1, where the editor made about 67.

**What was done.** A change is cut along the file's own runs of tracked changes, not the comparison's.
- **Where each piece is.** Each reading of the file now records where every piece of it is, as two markers per piece,
  by its place in its paragraph. They are shifted like the comment markers, for the italics' underscores.
- **The runs.** `changeRuns` takes the insertions and deletions with no unchanged words between them, carried across
  a paragraph's end where its mark is itself changed. It gives each run its place in the text the changes are found
  from, and in the file as it reads. A move is not part of a run.
- **Merging.** `alongRuns` makes the comparison's changes inside one run one change (`mergedHunk`). A change is in a
  run where what it changes overlaps the run in either text — not the word an insertion is anchored on, which may
  be in the run before.
- **The comparison still decides what is drawn.** Inside the change, "his" is shown as kept.

**Edits made with tracking off** have no runs. `wordsApart` merges two that are only one word apart, with no
sentence's or clause's end from the first to the second. "He had. It dropped." made "He held. It fell." stays two.

## T1.4: changes outside the scenes

**What was wrong.** The editor's two title-page edits were dropped without a word: a corrected word count, and her
name printed twice cut to once. A chapter heading changed would have been dropped the same way.

**What was done.**
- `outsideScenes` lists each title-page line or chapter heading with a tracked change or a comment, as it was and as
  it reads. A scene break is never one.
- They come in as suggestions with no scene, marked `outside`. The summary says *N changes are outside the scenes,
  on the title page or a chapter's heading: read them in Changes, and make them by hand*. Comments on them are
  counted with the comments not brought in.
- In **Changes** they come first, in their own region, *Changes outside the scenes*. They say why they cannot be
  accepted — the title page and headings are made afresh by each export — and each has **Dismiss**.

## T1.5: a restyled scene break

**What was wrong.** Cutting the paragraph before a `#` in LibreOffice saved the `#` as Normal, with no record of the
change. `isProse` decided by style, so the `#` would have come in as a line added to the scene's prose. The editor
saw it happen and redid her cut, so it did not reach the writer.

**What was done.** `isProse` takes a paragraph that is nothing but `#`, or `END`, as the export's own, whatever its
style. A `#` within prose ("Room #4") is still prose.

## T1.6: LibreOffice's bookmarks

**What was wrong.** The export marked each scene with a bookmark around its paragraphs. LibreOffice saved those
broken, measured on a plain open-and-save of the round-1 file (scratchpad `t13/probe.py`):

| The export's bookmarks | Before the save | After the save |
|---|---|---|
| Around each scene (as was) | 18 starts, 18 ends | **34 starts**, 18 names, 18 ends |
| A point at each scene's first word | 18 starts, 18 ends | **18 starts, 18 ends, all whole** |

**What was done.** The export writes each scene's bookmark as a point at its first word, opened and closed together.
- Bringing a file in reads a bookmark as where its scene starts, so a point is all it needs.
- Files already sent with ranges are read as before.
- `docPara`'s `tail` option, which only the closing bookmark used, is gone.

## Measured, on the run's files

| | Before (after T1.2) | After | The editor's own count |
|---|---|---|---|
| Round 1, changes in the scenes | 81 | **64** | 66, of which 2 on the title page |
| Round 1, on the title page | dropped | **2, listed** | 2 |
| Round 2 | 22 | **14** | 14 |
| "in his hand" → "under his seal" | 2 changes | **1** | 1 |
| Any order of accepting gives the file's text | yes | yes | — |

## Tests

- **`docxRunFiles.test.ts`:**
  - each round counts the editor's own number of changes;
  - "in his hand" → "under his seal" is one change;
  - her first save, with the restyled `#`, brings in no `#`;
  - round 1's two title-page edits are listed as she made them.
- **`docxImport.test.ts`:**
  - a deletion beside an insertion is one change;
  - changes with the file's unchanged words between them are two;
  - untracked edits one word apart are one, and two words apart, or across a full stop, are two.
- **`docxRead.test.ts`:**
  - a heading's change and a title-page comment are listed, and a scene break and unchanged lines are not;
  - a bare `#` or `END` parts scenes whatever its style, and a `#` within prose is prose.
- **`manuscriptExport.test.ts`:** an export for an editor has one point bookmark per scene, each closed where it
  opens, and each scene is found from it.
- **`e2e/wordRoundTrip.spec.ts`:** a replacement and a chapter-heading change:
  - the summary counts 2 changes in 1 scene, and says 1 is outside the scenes;
  - the heading's change is listed in its region and dismissed;
  - the replacement is one item, accepted with **Accept all 1**.

**Mutants**, gated on `tsc && eslint && echo MUTANT-OK && grep` (scratchpad `t11/mutants.py`). All nine were
killed:
- runs ignored;
- no runs read;
- untracked edits never merged;
- untracked edits merged across a full stop;
- changes outside the scenes dropped;
- a heading taken for the title page;
- a restyled break taken for prose (killed by the hand-made test and the editor's own file);
- the bookmark a range again;
- changes outside the scenes not stored (e2e).

One change went untested: ending a run at every paragraph's end. No file in hand has a tracked change running
across a changed paragraph mark with words on both sides, so that mutant would survive. It was not run.

## Not done here

- **A run across a changed paragraph mark** is joined in `changeRuns` but has no test of its own, as above.
- **Changes outside the scenes are not marked on the Page**, which shows only scenes.
