# R3: named drafts of the book

The third part of the editorial plan (`editorial-plan.md`).

## What was built

- **A draft** (`src/lib/bookDraft.ts`) is the whole book: every chapter in the book's order, every
  scene in its chapter's order, each with its id, title and prose. It is saved under a name, gzipped
  (`src/lib/gzip.ts`), in a new table, `bookDrafts` (Dexie v64), with its word and scene counts for
  the list. It is not journalled: a draft is a record of the book, not an edit to it.
- **Comparing two** (`compareDrafts`) matches scenes by id and names, for each scene that changed:
  - *edited*, with the words before and after;
  - *renamed*, with the old title;
  - *moved*: to another chapter, or out of order with the scenes around it. That is everything not in
    the longest run of scenes still in the same order, so swapping two scenes is one move, not two.
  - *added*, or *split from* a scene. A split keeps the first half in the scene and gives the rest to a
    new one, so a new scene is a second half when at least half its paragraphs were in a scene that
    no longer has them.
  - *removed*, or *joined into* a scene. A join appends the second scene's prose to the first and
    deletes the second, so a scene that is gone was joined when at least half its paragraphs are in a
    scene that did not have them.

  The scene a split came from says *split into*, and the scene a join went into says *took in*, so
  their shorter or longer prose reads as moved, not cut or written.
- **The Drafts dialog**, from **Drafts** in the Manuscript's header:
  - save a draft under a name; list drafts with their date and size; delete one, after a confirm;
  - compare a draft with the book now, or with another draft;
  - open each changed scene in the same diff as a scene's History (`ProseDiff`, taken out of
    `SceneHistoryDialog`);
  - comparing with now, restore a scene's prose from the draft.

  A restore keeps the scene's current prose in its History first (`restoreSceneProse`, which scene
  history's own restore now uses too). A whole draft is not restored.
- **Travel.** Drafts stay on the device. **Export a .pwk copy…** in World settings offers **Include the
  book's drafts**, unticked, when there are some. An imported copy adds its drafts to the device's,
  and a copy without drafts removes none, whether imported or merged.

## Where it departs from the plan

The plan put *Include drafts* on "the full backup (`.pwb`)". That was wrong: a `.pwb` is the pictures
half of a split export, not a fuller backup. The box is on the `.pwk` export instead, unticked, which
keeps decision D-2's intent that drafts travel only when asked. The plan and D-2 are corrected.

Two further departures:
- The box is on the World settings export only, not on the world card's two export items. Those are
  single menu buttons with no room for a box.
- Renaming a draft was not built. The list offers what the plan asked for: save, compare, delete.

## Found while building it

- **A split's first half looked cut.** Its diff struck out the paragraphs that had moved to the new
  scene. The comparison now names the split on both halves: *Split: the rest is now "The Count"*.
- **A restore can turn a split into an addition.** Restoring the first half from the draft puts the
  moved paragraphs back in it. The new scene's words are then in both places, and the comparison calls
  it *added*, not a second half. That is right, and the e2e test asserts it.

## Checked

- `bookDraft.test.ts`:
  - no change; an edit, with word counts; a rename;
  - a move to another chapter, and a swap counted as one move;
  - a split, a join, and a join edited since;
  - adds and removes that are neither, including a copied paragraph that is not a split;
  - `draftOf`'s order, and gzip.
- `bookDrafts.test.ts`, against the real store:
  - saved whole and gzipped, and read back as the book was;
  - compared after a real `splitScene` and an edit;
  - a scene restored, with its newer prose kept in History; a scene that is gone not restored;
  - deleted; going with its world; not in the backup;
  - carried in a file only when asked, added to the device's drafts on import, and never removed by
    an import or merge without them.
- `exportImport.exportWorld.test.ts`: `exportWorld` leaves drafts out unless asked, and carries them
  when asked.
- `e2e/bookDrafts.spec.ts`, against the Page:
  - a draft saved and named;
  - the scene split with Ctrl+Shift+Enter, and its first line edited;
  - compared: the first scene shown as edited and split, the second as split from it;
  - the diff's added and removed words;
  - the first scene restored, and the comparison refreshed.
- Mutants, each caught:
  - no split; no join; order ignored; all of a scene required; renames ignored; no check that the
    source scene lost the paragraphs;
  - a restore keeping no History; an import deleting drafts; drafts always exported;
  - in the dialog: no refresh after a restore; the name ignored; restore offered on the wrong scenes;
    no note of the split.

  Five mutants did not compile at first, and were redone until they did.
- The full e2e suite, against the dev server: 852 passed and 174 failed (33.6 minutes).
  - The failing spec files are the R1 run's, which need the Library, less `manuscriptPhone` (fixed in
    R1) plus one, `sceneSplitJoin`.
  - Its two Focus-mode split tests fail about as often on `development` without R3: 8 runs in 18
    there, 7 in 18 here. They are flaky under a dev server, and not R3's.
