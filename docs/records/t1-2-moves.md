# T1.2: a move is one change

**Plan:** `round-trip-plan.md`, T1.2.
**Finding:** RT-2 in `writer-run-2026-11-09-blind-editor.md`.

## What was wrong

The editor moved a sentence in round 1, and a sentence and a paragraph in round 2. `docxRead` read the text moved
away (`w:moveFrom`) as a deletion and where it went (`w:moveTo`) as an insertion. Those were two changes, each
with its own Accept:
- Accepting the deletion alone cut the words.
- Accepting the insertion alone put them in twice.

**The paragraph move read worst.** The editor moved the Black Mare's paragraph above Ilse's. The comparison of the
whole scene found the shorter description: Ilse's paragraph moving below the Black Mare's. So the first change the
writer saw was **Ilse's whole paragraph, struck through, "→ (removed)"**: the paragraph the editor's letter
praised.

## What was done

**Moves are pieces of their own.** `docxRead` marks a moved piece, and a moved paragraph mark, as `moved`.

**The file is read in steps** (`docxEdits.ts`), when a scene has a move. Besides every change rejected and every
change accepted, there are two readings between them:
- `out`, with only the moved-away text taken out;
- `moved`, with it also put where it went.

The halves are found against these, and every other change is from `moved` to the file as it reads.
- A move is then the editor's own: the Black Mare's paragraph taken out and put above Ilse's. Ilse's paragraph is
  no change at all.
- `movedRuns` gathers, from the markup, the runs of words each scene moves out and in. A paragraph moved with its
  mark carries on into the next.

**Halves are laid on the moved words** (`onMovedWords`, `docxImport.ts`). A comparison can find an insertion a few
words off.
- In round 2, "He had come across the marsh…" went in before "He had been sitting…". It was found as "come across
  the marsh… He had" put in after "He had". That gives the same text, reads as nonsense, and is not the words moved
  out.
- Where a half is not on one of the runs, it is looked for to the left, as far as its own length. That means the
  same number of characters, taken out or put in there instead, which leave the same text and are one of the runs.

**Halves are paired by their words**, in the file's order. This is needed because LibreOffice writes no name on a
move (`w:moveFromRangeStart`): there were none in either of the run's files.
- The pair may span two scenes.
- A half with no other is an ordinary change.

**Storage** (`EditSuggestion.move`).
- Each half is a row, with its scene, sharing an id with its other half. The field is not indexed, so there is no
  Dexie version.
- `editSuggestions` is not in backups, so there is no `.pwk` change.
- `changeCount` counts a move once. The import's summary, **Changes · N** and the dialog all use it.

**Accepting and rejecting** (`useEditImport.ts`).
- `acceptSuggestion` on either half makes both, in order, in one write: the words taken out, then put in. Each
  scene's prose is captured in its History first. If either half can no longer be made, neither is.
- `rejectSuggestion` drops both halves.
- `acceptScene` passes over a half already made with its other half.
- `rejectScene` takes a move's half in another scene with it.

**Shown as one.**
- On the Page, the words are struck through twice where they were (*moved from here*) and underlined twice where
  they go (*moved here*), as Word draws moves.
- In **Changes** a move is one item: **⇄ Moved**, its words, and *From after "…" to after "…"*. A move between
  scenes is listed under both, naming the other.

## Measured

On the run's files:

| | Before | After |
|---|---|---|
| Round 1 | 82 changes; the moved sentence as 2 | **81**: 80 changes and **1 move** |
| Round 2 | 24 changes; 2 moves as 4 | **22**: 20 changes and **2 moves** |
| Round 2's paragraph move | Ilse's paragraph "removed", then put back | **The Black Mare's paragraph moved up**; Ilse's unchanged |
| Round 2's sentence move | "come across … He had" put in | **"He had come across the marsh…"**, its own words |
| A scene's changes in either order give the file's text | yes | yes, with the moves |

The editor's own counts were about 67 edits in round 1 and 14 in round 2. The rest of the difference is
replacements split into words: T1.3.

## Tests

- **`docxRead.test.ts`:** a scene with a move has its two steps and its moved words; a scene without has none; a
  paragraph moved with its mark is one run.
- **`docxRunFiles.test.ts`:**
  - round 1 has one move, and round 2 two, each half on the same words;
  - Ilse's paragraph is in no change;
  - every scene, accepted in either order with its moves, reads as the file.
- **`docxImport.test.ts`:** a sentence moved before one that starts with the same words, laid on its own words; a
  move across two scenes; a half with no other as an ordinary change.
- **`editImport.test.ts`:**
  - a move counted once;
  - accepted from either half, both made in both scenes;
  - rejected from either half, both gone;
  - one half no longer makeable, neither made;
  - a scene accepted whole makes the move once;
  - a scene rejected whole takes the other scene's half.
- **`e2e/wordRoundTrip.spec.ts`:** a sentence moved as LibreOffice writes it:
  - the summary says one change;
  - both halves are marked on the Page with their titles;
  - **Changes · 1** and one item, *Tracked change: moved "The road was long."*, with where from and to;
  - accepted, the sentence is once, in its new place.

**Mutants**, gated on `tsc && eslint && echo MUTANT-OK && grep` (scratchpad `t11/mutants.py`). All nine were
killed:
- moves unmarked;
- no move steps;
- no laying on the moved words;
- halves never paired;
- a half accepted alone;
- the other scene's half left on a scene's rejection;
- a move counted twice;
- a move shown twice in its scene (e2e);
- the Page's halves unsaid (e2e).

A tenth mutant survived, and is equivalent rather than a gap: `changeCount` counting the 'to' half instead of the
'from' half gives the same count. It was replaced with one that counts both halves, which was killed.

## Not done here

- **A move made without move markup** — cut and pasted with tracking on, which Word and LibreOffice write as a plain
  deletion and insertion — is still two changes. Pairing identical deletions and insertions with no markup would
  pair words that merely repeat. Left until a file shows it.
- **Untracked edits that touch a change are not merged in a scene with a move** (T1.1's `oneChangePerGap`), because
  its changes are found on different texts. No file in hand has both.
