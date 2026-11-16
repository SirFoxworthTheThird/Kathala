# T7.1–T7.2: a change made only where it was, and a note that does not jump

**Plan:** `round-trip-plan-2.md`, T7.1 and T7.2.
**Findings:** R2-1, R2-3 and S5 in `writer-run-2026-11-10-loop.md`.

## What was wrong

- **R2-1.** The writer had rewritten the sentence that held *"…and then he looked at Edric Vane"*. Accepting the
  editor's change on it, *looked at → raised his eyes to*, found the *looked at* in Agathe's line and changed that one
  instead: *she raised his eyes to him for a long moment*. No message was shown.
- **R2-3.** A note whose words the writer had rewritten moved to a sentence four chapters off that only read like
  them. It was labelled *Its words have been edited since*.

**One mechanism.** `applyHunk` placed a change through `placeNote`, the note matcher.
- `placeNote` counted surroundings that did not match as a cost, never as a reason to refuse, so any exact copy of a
  short passage won.
- When a passage's exact words were nowhere, it also looked for near-matches in every other scene.
- For a note, following its words is the R1 design. For a change, it is wrong: a change is to *those* words, where
  they stood.

## The measure

There are four files, from two runs: `run-2026-11-09` and the loop's `run-2026-11-10-loop`, now a fixture beside it.
Every change was applied in either order, and its context was measured: how many characters of the words recorded
around it still stand beside it.

| | Placements | Characters of context |
|---|---|---|
| Where each change was made | 326 | **at least 32** |
| Any other copy of its words in the scene, once its sentence was rewritten | 932 | **at most 21** |
| R2-1, the *looked at* in Agathe's line | 1 | **3** |

**The threshold is set between them: 24** (`MIN_CONTEXT_CHARS`).

**A scene's start or end counts as surroundings.** A change recorded against a scene's start or end, and still there,
is credited with the rest of its 32 characters.
- **How it was found.** `e2e/wordRoundTrip.spec.ts` failed twice on the first form, which had no such credit. Both
  were changes at a scene's last words, where the writer had retyped a word before them.
- **Why it failed.** With nothing after the change, the words before it were all its context, and one retyped word
  left 22.
- **The measure above did not see it.** It measured the editor's own files, in which the writer had changed nothing
  near a change.

## What was done (`noteAnchor.ts`, `docxImport.ts`)

- **A change is strict** (`placeNote(…, strict)` from `applyHunk`).
  - It is made only where at least 24 characters of its surroundings are still beside its words.
  - It is made nowhere where two places tie.
  - Otherwise it is refused, as a change whose words are gone already was: *The scene no longer has these words…*.
- **The words lightly retyped, where they were, are still found.** An exact copy of them in the wrong surroundings no
  longer stops the search for them retyped in place: the search waits on a place *accepted*, not on any exact copy.
- **A note follows only its exact words in another scene,** as a split, a join or a moved passage leaves them. It is
  never moved to a near-match there.
  - Retyped words are looked for in its own scene only.
  - Notes are not held to the context minimum: a note on words moved by a split has none of its surroundings, and
    R1 follows it.

## Tests

- **`docxRunFiles.test.ts`, the loop's files:**
  - round 1 has 60 changes and round 2 has 21, with none made with tracking off and 39 and 22 comments in the scenes;
  - **R2-1 verbatim**: the editor's change, and the scene as History kept it just before the Accept, is refused.
- **The floor and the ceiling, on all four files.** All 326 changes are made where they were, in either order. With
  40 characters either side rewritten, none is made anywhere. 97 of those had another copy of their words in the
  scene to be taken for them.
- **`docxImport.test.ts`:**
  - a change made in its own sentence, not the first *looked at* in the scene;
  - still made with a word retyped beside it, and with words retyped on both sides;
  - refused with its sentence rewritten, and refused where two places tie;
  - its words retyped in place, though an exact copy stands elsewhere;
  - at a scene's end, made with a word retyped before it, and not made with the same words no longer at the end.
- **`noteAnchor.test.ts`:** a note on *The tide was going out*, its sentence rewritten, is unplaced, not moved to
  *The tide was coming in* in another scene. Retyped in its own scene, it is found. Moved exactly to another scene,
  it is followed.
- The note tests that already existed (splits, joins, retypes, repeats, `placeNotes`) pass unchanged. A first form
  that held notes to the context minimum too broke three of them, which is why notes are not held to it.

**Mutants**, gated on `tsc && eslint && echo MUTANT-OK && grep`. All nine were killed:
- no credit for a scene's edge;
- the edge credited wherever the change is;
- `applyHunk` not strict;
- no context needed;
- a minimum of 3;
- a minimum of 40, killed by words retyped on both sides of a change;
- ties allowed;
- near-matches followed into other scenes;
- no search for the retyped words after an exact copy was refused.

Two first forms did not build (an unused `tied`, and a narrowing lost), and they were redone.

**The specs that bring in changes and notes** passed on a production build: `wordRoundTrip`, `proseNotes`,
`betaReaders`, `prosePass`, `revisionTasks` and `closeAnywhere`, 23 tests. The full unit suite passed.
