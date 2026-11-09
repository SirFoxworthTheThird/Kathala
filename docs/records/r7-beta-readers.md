# R7: notes from beta readers

The seventh and last part of the editorial plan (`editorial-plan.md`).

## What was built

- **A reaction is a note** (R1). It is on the words the reader chose, or on the paragraph they tapped.
  - `ProseNote.reaction` is one of five reactions: *lost*, *slow*, *loved it*, *didn't believe it*, *where am I?*.
  - Its author is a reader. In the reader's copy the reader has no name yet (`isOwnReaderNote`).
  - The body is the reader's line, if they wrote one.
- **On Read, in reading mode** (`ReaderNotes.tsx`):
  - **Notes for the author**, in the reader's row, turns reacting on.
  - With it on, words chosen in one paragraph, or a paragraph tapped with nothing chosen, open a bar with the five reactions and a line to say why.
  - Offsets come from the page's text (`plainScene`, as R6). Each paragraph carries its index as `data-p`, so a selection inside it is counted from its start.
  - **Your notes · N** lists the reader's notes, each one deletable, and **Send to the author** saves the file.
- **The file** (`readerNotes.ts`, decision D-3) holds:
  - its kind and version;
  - the book's id and name;
  - the reader's name;
  - where the reader's place in the book was;
  - when it was sent;
  - each note's words, the few words either side, its reaction and its line.

  It holds nothing else of the book, so it stays small, and bringing it in cannot overwrite the writer's book. It is named after the book and the reader: `the-long-road-notes-from-ines.json`. Reading it says plainly what is wrong with a file that is not one, is damaged, or comes from a newer Kathala.
- **Bringing it in** (`importReaderNotes`):
  - A file on another book is refused.
  - In one write, and one step of undo, the reader's earlier notes are taken out and these are made, each as a note by the reader by name.
  - The reader is recorded on the book (`World.betaReaders`) with how far they read, how many notes they sent, and when.
  - A second file from the same reader, whatever the case or spacing of their name, replaces the first. They send all their notes each time, so the newest file is the whole of them.
- **The writer's side:**
  - **Bring in a reader's notes…**, beside **Bring in edits…**.
  - In the Notes panel, **From** lists each reader by name as well as every reader together (`readerFilter`), and a note's label is its reaction.
  - **Readers · N** lists the readers and shows **the reactions map** (`readersMap`), narrowed by **Whose reactions**: chapter by chapter, each reaction's count, the readers' notes with no reaction, and the readers whose place is in that chapter. A place is found by its scene, or by its chapter's number where the writer has since removed the scene.

## Where it departs from the plan

- **Undo takes back a file's notes, not the reader's place.** The reader's record is on the world, and the world's own fields are written outside the undo history. Undoing a file brings back the reader's earlier notes, and the reader's entry stays as the newer file had it until their next file.
- **"Send" saves a file.** The app has no way to send anything anywhere; the reader sends the file however they send files.
- **A note on a paragraph is on the whole paragraph**, as its quote. A long paragraph makes a long quote, which a note finds as it finds any other.

## Checked

- `readerNotes.test.ts` (the file):
  - what it holds and nothing more;
  - read back as written;
  - its name;
  - a file that is not one, is damaged, or is newer;
  - an unknown reaction dropped;
  - one reader whatever the case.
- `readerNotes.test.ts`, against the real store:
  - The reader's own notes alone go in the file, and none of the prose.
  - Brought in against the book as it is now, after the writer has rewritten one passage: the note on words still there is placed on them, and the note on the rewritten words is unplaced. The reader is recorded with how far they read.
  - A second file from the same reader replaces the first and leaves another reader's notes alone; undo puts the first back.
  - A file on another book is refused, and nothing is made.
- `noteList.test.ts`: each reader is a filter of their own, and readers together are one too.
- `readersMap.test.ts`:
  - a chapter's reactions, by readers only, in the book's order;
  - where each stopped, by scene or by chapter number;
  - one reader's alone.
- `e2e/betaReaders.spec.ts`, in two browsers:
  - The writer exports the book. The reader opens it in reading mode, reacts to words they chose with a line ("Lost") and to a paragraph they tapped ("Loved it"), reads their notes over and sends them.
  - The file holds the two notes and not the book's other prose.
  - The writer brings it in. The notes are on their words on the Page, under the reader's name in the Notes panel with their reactions, and on the map, with where the reader stopped.
- Mutants, each caught:
  - the file: of any kind; from a newer Kathala; an unknown reaction kept; names told apart by case; reactions not sent;
  - bringing it in: another book's taken; earlier notes kept; a reader recorded twice; not one step of undo; named notes sent again as the reader's own;
  - the filter: every reader for one;
  - the map: editors' notes counted; no place by chapter number; one reader showing everyone's;
  - on screen: no tapping a paragraph; chosen words counted from the paragraph's start; the reader's line lost; reacting outside reading mode; no reader in **From**; no reaction label; the reader's place not sent.

  Two mutants did not compile at first, and were redone until they did.
