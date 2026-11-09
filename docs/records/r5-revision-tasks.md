# R5: a revision checklist

The fifth part of the editorial plan (`editorial-plan.md`).

## What was built

- **A task** (`src/types/revisionTask.ts`) says what to do. It may also have:
  - a group: the heading it stood under in a letter;
  - links to the chapters, scenes and characters it is about;
  - a source: a letter, a note on the prose, or a finding of the continuity check or an AI audit.

  It is open or done. Done tasks are kept: with the resolved notes, they are the record of the
  revision.
- **Storage** (`useRevisionTasks.ts`) is a new table, `revisionTasks` (Dexie v66).
  - Every write is journalled, so each is a step of undo.
  - A delete leaves a tombstone, so a merge does not bring the task back.
  - Tasks travel in `.pwk` and in folder sync, and are merged by id. The `.pwk` version goes to
    21, so an older Kathala refuses the file rather than dropping its tasks.
  - A world deleted takes its tasks with it.
  - A letter's tasks are added in one write, as one step of undo (`addRevisionTasks`).
- **A letter, split** (`src/lib/editorialLetter.ts`, `splitLetter`):
  - It is cut at each bullet and numbered point (`-`, `*`, `•`, `1.`, `2)`, `(3)`, `a.`), and between
    paragraphs. A point's wrapped lines stay one point.
  - A heading can be a Markdown heading, or a short line that is not a sentence, standing alone or
    over points. A sentence ending in a colon over points is a heading too. Each heads the points
    after it, until the next heading.
  - A heading with nothing under it is a point, as written. So is a heading-like line straight after
    a heading.
  - The greeting and the sign-off, with the name under it, are offered unticked.
- **Links offered** (`suggestLinks`), for each point:
  - the chapters it names by number: *chapter 3*, *ch. 12*, *chapters 4 and 6*, *chapters 7–9*,
    *chapter three*;
  - the characters it names, found by `castAliases`, the same matcher the Page uses for names in the
    prose. Matches are whole words, case as written, and a word two characters share counts for
    neither.
- **On screen:**
  - **Revisions** on the dashboard (`RevisionsSection`): *N of M done* with a bar, a line to add a
    task, **Paste an editorial letter…**, the open tasks, and the done ones on asking.
  - **The letter dialog** (`LetterDialog`): paste, then split. Each point is offered with its links;
    keep or untick it, **Merge up**, and turn a heading into a point with **Not a heading**. Then
    **Add N tasks**.
  - **A task** (`TaskList`): tick done, click to change its words, delete. Each link opens what it
    is linked to; links are added with **Link** and removed with **×**. The source line is the way
    back: a note's opens the Page with the Notes panel at the note, and a finding's opens the
    Continuity Checker.
  - **A chapter's panel** (`ChapterTasks`) lists the tasks linked to the chapter or to any of its
    scenes, with its own count, and adds a task linked to the chapter.
  - **Make a task** on a note in the Notes panel, and on a row of the Continuity Checker. The
    checker's rows include an AI audit's findings, which say so. The task is linked to the chapter
    and scene. After that, the button says **A task** and does nothing more.
  - All of it is the writer's: none of it is shown in reading mode.

## Where it departs from the plan

- **Links are suggested, not only made by hand.** The plan asked for tasks linked to chapters,
  scenes or characters. A letter names chapters and characters, so its points are offered with
  those links already found. The writer sees them before adding and can remove any after. Scenes
  are not suggested: a letter rarely names a scene by its title, and a scene's title is often an
  ordinary phrase.
- **A heading is a guess the writer can undo.** "Cut the prologue", with no full stop, looks exactly
  like a heading. So headings are shown as headings in the dialog, each with **Not a heading**,
  rather than silently grouping what follows.
- **The way back to a finding opens the checker, not the finding.** The checker has no way to be
  opened at one row. The task keeps the finding's words, so it can be found there.
- **A link to something deleted is kept, not shown.** Deleting a chapter, scene or character does
  not rewrite tasks; the link is left out wherever tasks are listed. A merge, or an undo of the
  delete, brings it back.

## Checked

- `editorialLetter.test.ts`:
  - bullets, numbered points and paragraphs, with headings over them and groups kept;
  - a colon sentence over points; a heading over nothing; a heading-like line under a heading;
  - wrapped lines, Windows line ends and runs of blank lines;
  - the greeting and sign-off, and a short last point that is not a name;
  - merging, never across a heading;
  - chapter numbers, single, listed, ranged and in words;
  - links to chapters and characters, with a shared surname naming neither.
- `revisionTasks.test.ts`, against the real store:
  - made, linked once however often said, changed, done, opened again;
  - a letter's tasks in order after those already there, as one step of undo;
  - undo, and a delete's tombstone; going with the world;
  - in the backup, at version 21, imported back, and a file from before tasks still imported;
  - merged: a task from the other device arrives, one deleted here stays deleted, and one done
    there is done here.
- `e2e/revisionTasks.spec.ts`:
  - A letter is pasted and split. A heading is turned into a point and the letter split again.
    Two bullets are merged and the tasks added.
  - On the dashboard: the count, the heading and the links are checked. A chapter is linked by
    hand and a task ticked done.
  - Chapter 2's panel shows its task. Chapter 1's shows both, and a task added there is linked to
    it.
  - A task is changed and deleted.
  - A note and an AI audit's finding are each made into a task, once. A task linked to its scene
    only is still in its chapter's panel. Each task's way back is followed: to the checker, and to
    the note.
- Mutants, each caught:
  - splitting: no bullets; no Markdown headings; a heading over a sentence; a heading-like line under
    a heading; no colon sentence over points; a heading over nothing kept as one, or not as written;
    wrapped lines split; no greeting or sign-off; any short last line taken for a name;
  - tasks from points: the group lost; unticked points made; merging across a heading, or
    losing a tick;
  - links: no ranges; no number words; no characters; characters out of order; a name found
    inside another word;
  - storage: links not deduplicated; order restarting; a letter not one step of undo; empty tasks
    made; `doneAt` kept on reopening; not exported, merged or imported; kept when the world is
    deleted;
  - on screen: the note's panel not opened, or not handed the note; **Make a task** always offered,
    or offered for the wrong note; scene links not counted in a chapter's panel; merging, keeping or
    **Not a heading** doing nothing; no links or no source on a letter's tasks; the count wrong; done
    tasks listed as open; **Link** and **×** doing nothing; an edit not saved; delete doing nothing;
    a chapter's task not linked to it; an audit's finding said to be the continuity check's; the
    checker not opened; a finding's task not linked; a chapter link opening no chapter.

  Five mutants did not compile at first, and were redone until they did.

## Found while building it

- **"Revision tasks for chapter 1" broke seven tests**, in `pageView`, `timelineOneScreen` and `manuscriptPhone`. A lookup of the region "Chapter 1" matches
  any name containing it, so the panel's own region and the task list inside it were both found.
  The list is now *This chapter's revision tasks*. CLAUDE.md warns of exactly this.
- **Ticking a task moves it out of the open list at once**, so a test cannot tick it and then look
  for it ticked where it was. The spec clicks it and checks the count.
- **The e2e run**, against the dev server, over the specs for the dashboard, the continuity checker
  and audits, notes, undo, import and export, the Word round trip, the binder and the Page. The
  first run had 122 passed, 8 failed and 1 flaky: the seven above, and one that needs the Library.
  After the rename, everything passed except two things:
  - `dashboardTiles`'s Maps test needs the Library, which the container cannot reach.
  - `binder`'s *going to a scene opens it* is flaky on `development` too: over 28 runs it failed
    twice there and five times here. That is too few to say R5 makes it worse; it is a race older
    than R5.
