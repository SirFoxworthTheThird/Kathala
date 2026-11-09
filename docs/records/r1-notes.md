# R1: notes on the prose

The first part of the editorial plan (`editorial-plan.md`). A note is something said about a passage — a
query, a cut, a fact to check, praise — pinned to its words on the Page.

## What was built

- **Anchoring** (`src/lib/noteAnchor.ts`). A note keeps the words it was made on, a little of the text
  either side, and its scene. It is found again each time it is shown, in this order:
  1. its words exactly, in its own scene, with repeats told apart by their surroundings;
  2. its words exactly, in another scene, where a split or a join moved them;
  3. its words with up to a quarter of their characters changed — a word retyped — for a passage of 16
     characters or more.

  Past that the words have been rewritten, and the note is kept, **unplaced**. A match never starts or
  ends inside a word, unless the writer's selection did.
- **Storage.** A `proseNotes` table (Dexie v63).
  - It is journalled: each act on a note is an undo step, and a delete leaves a tombstone.
  - It is in `.pwk` and `.pwb` and in folder sync, and it merges by id. The export format is 20, so a
    reader of format 19 refuses such a file rather than dropping the notes.
  - A deleted scene keeps its notes, unplaced; a deleted world takes them with it.
- **The Page.**
  - **Add note** (Ctrl+Alt+M), for words chosen in a scene's prose.
  - A mark on each open note's words, kept on them as the page is typed in. Clicking it opens the note.
  - **Notes · n**, which opens and closes the panel.
- **The Notes panel** (`src/features/notes/`).
  - Notes are listed in reading order, and filtered by status, chapter and who wrote them.
  - Each can be gone to, answered, edited, resolved, reopened or deleted.
  - A note whose words were edited says so. Acting on it moves it onto them, in the same undo step as
    the act.

## Where it departs from the plan

The plan had the Page follow a note's words through typing by CodeMirror's position mapping, and
rewrite its quote when the scene saved. That was not built:

- A quote rewritten on every save is a journalled write with every prose save. Each would be an undo
  step the writer did not make, or a journalled table written outside the journal, which `CLAUDE.md`
  forbids.
- Prose also changes away from the Page: in a scene card, in Focus mode, and in Find & replace.

Instead, nothing rewrites a note as the prose changes. A closest match finds its words edited, and the
note moves onto them only when the writer acts on it. Marks are drawn from the prose in view, so they
follow typing all the same.

## Found while building it

- **"look back." retyped as "look behind." was found as "look b".** Stopping inside the new word
  changed fewer characters than taking all of it. Matches now keep to word edges. Between stretches
  equally close, the match is the one that ends on the quote's own last character, then the one nearest
  its length.
- **An exact match could land inside a word.** A note on "art" would have moved into "party". Exact
  matches keep to word edges too.
- **The Page's key hints stood twelve lines tall beside the panel.** The row was narrower than the
  window width the hints were shown by. The hints now give way while the panel is open.
- **On a phone the new buttons cost the page its height** (`manuscriptPhone.spec.ts`). The writing
  area with the keyboard up fell from over 300px to 297, and tapping into the prose moved it by 8px.
  - Notes in the header's row was worse: with a chapter open the row wrapped, giving 278px and a
    48px move.
  - On a phone, Notes is now under **Book tools**. The panel offers *Add a note on the chosen words*,
    and a mark still opens its note.
- **A notice was squeezed to 242px at 1280px** (`pageRetitleAndSave.spec.ts`, W-6) by the two new
  buttons beside it. While there is something to say, the notice now takes a line of its own.

## Checked

- `noteAnchor.test.ts` covers:
  - edits either side of the words, and repeats;
  - split, join and Replace all;
  - a word retyped inside the words, and rewording;
  - short passages, word edges, folding (case, quotes and dashes), and `placeNotes`.
- `noteList.test.ts`: ordering and filters. `proseNotes.test.ts`: the record, undo, tombstones,
  deletes, the backup and merge.
- `e2e/proseNotes.spec.ts` covers:
  - a note made on the Page, its mark followed through edits and a reload;
  - opened from its mark, resolved, reopened, and kept unplaced;
  - followed into a retyped word, gone to, answered (and moved onto its words), and deleted;
  - the key hints giving way to the panel;
  - on a phone: Notes under Book tools, and the panel's offer of a note on the chosen words.
- Mutants, each caught. Anchoring:
  - surroundings ignored, and its own scene not preferred;
  - no edits allowed; edits allowed for short passages; edits allowed up to 0.6;
  - other scenes not read;
  - exact matches inside words; matches ending inside words; no tie-break on the last character.

  The Page:
  - no marks; resolved notes marked; a mark's click doing nothing;
  - no move onto edited words; the key hints shown beside the panel;
  - Notes put back in the phone's header row.
- The full e2e suite against the dev server: 848 passed, 174 failed, and 1 flaky.
  - The production build cannot be made here: it needs the Library repository beside this one, which
    this container does not have, and the Library's site is blocked from it. So the suite ran against
    the dev server.
  - Of the failures, all but two are in specs that load Library books. Six of those specs failed the
    same way on `development` without R1. The other two were R1's, on a phone, and are fixed above.
  - At the tip, every Page, Manuscript and Timeline spec passes (151), except:
    - two Library specs;
    - `pageSceneKeys` (Focus mode), which also fails under load on `development` and passes five times
      in five alone.

  Four mutants did not compile at first, and one did not land. Each was redone until it compiled and
  landed before it counted.

## Not yet

- Marks are on the Page only, not on Read.
- Notes by an editor, a reader or a check have their kinds in the record, but nothing makes them yet:
  R4, R6 and R7 do.
- The screenshot (`docs/images/115-prose-notes.png`) uses a short invented manuscript, not a Library
  book. The Library's site could not be reached from where it was taken.
