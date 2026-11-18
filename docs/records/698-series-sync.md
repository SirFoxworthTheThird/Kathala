# A series in a folder (issue #698)

**Asked for after the series could be taken apart.** Folder sync worked one book at a time, and for a book of a series
that was half a feature. Its file went out on its own, with the series' cast under the series' ids, and bringing it
back over the book was refused (part 5). So a writer with a series in Dropbox could save to the folder and never load
from it. **Decided:** a book of a series is kept in a folder as its series is, as one file, the series' own
(`exportSeries`'s), holding the shared cast and world and every book.

**Code:** `syncKeyOf`, `syncVersion`, `seriesFileName` and `loadSyncBinding` in
`src/features/worlds/folderSyncRunner.ts`; `exportSyncData` and `previewSyncFile` in `cloudSyncHelpers.ts`;
`previewSeriesMerge` in `src/lib/exportImport.ts`; the Cloud Sync panel, the chip, the dashboard's nudge and auto-save.

## What it does

- **The folder is the series'.** A binding is kept under the world the folder holds: a book's series, else the world
  itself (`syncKeyOf`, which is `bibleOf`). Every book of a series reads the same binding, so a folder chosen in book
  two is book one's, with the same standing on the chip.
- **The file is the series' file**, `The_Salt_Books_series.pwk`. It is named apart from any book's file of the same
  name, since a book's file found where the series' was expected would read as another device's.
- **Its version is every part's.** Conflict detection compared one journal's seq with the seq at the last write. A
  series has a journal per book, plus the series' own, so its version is all of them in one string:
  `series:4|bookA:12|bookB:3` (`syncVersion`). An edit in any book moves it, and so does a book added or taken out.
  A world on its own keeps its number, so bindings already stored read as before.
- **Load brings the series in whole.** The preview is each part's preview added up (`previewSeriesMerge`), and
  Merge or Replace is `importSeriesData`. A file of another series in the folder is refused.
- **A book bound before it joined a series** gives its folder to its series, for the series' file, and its own
  binding goes, since a book's file in that folder could never come back. The series has not been written there, so
  the binding is recorded as though the folder held a file another device wrote: no file, and the next save writes
  it; a file, and it reads as *Newer copy in folder* (or *Both changed* after an edit here), never written over.
- **Disconnect**, in a book of a series, disconnects the series, and its confirm says so.
- **A book taken out, or the books of a dissolved series,** are not saved to the series' folder any more, and their
  chip says *Not backed up* until a folder is chosen for each.

## Found on the way

- **Auto-save's decision could not be told apart in the e2e.** A mutant that had auto-save read the book's own
  journal in place of its series' survived, because the spec saves only after an edit, and with an edit both read
  as *ahead*. The difference is where it must *not* write: in step, or over another device's file. That decision
  was inside a React effect, behind a 30-second timer, so it moved into the runner as `autoSaveToFolder`, which the
  hook calls and the unit tests drive.

- **A headless Chromium closes the page when an OPFS directory handle is read back from IndexedDB.** A probe stored
  `navigator.storage.getDirectory()`'s handle in IndexedDB and read it back, and the page closed with no crash event.
  The app keeps a picked folder in IndexedDB and reads it back at every look, so the e2e spec's folder picker
  returns a stand-in instead. It is plain data, which the store keeps, with its methods on `Object.prototype` for that
  page only, and its files in OPFS. The guide's screenshot is taken the same way.

## Tests

- `src/lib/__tests__/seriesFolderSync.test.ts`, 10, driven through the real runner with a fake folder, as
  `folderSyncRoundTrip.test.ts` is:
  - a book reads its series' binding, and a save writes the series' file, the cast once and both books;
  - a world on its own keeps its own binding and its own world file;
  - an edit in book two, a book added, and a book taken out each move the series from in step to ahead;
  - two devices: book two's scene and the shared Anna renamed on one device reach the other through the series'
    file, the preview counting both; then both edit, and the second save goes to a conflict copy, a series file;
  - a file of another series in the folder is not brought in;
  - a book bound before it was in a series gives its folder to the series under the series' file name, and its own
    binding goes; with no file there it is not yet saved, and with another device's it is *remote-ahead*, then
    *conflict* after an edit here;
  - auto-save (`autoSaveToFolder`): a book's look saves the series; in step, a change the journal does not hold
    writes nothing; an edit in book two, looked at from book one, is saved; a series another device saved is left
    to load, and with an edit here too goes to a side copy, the folder's file untouched; a book with no folder is
    not saved.
- `e2e/seriesSync.spec.ts`, 1:
  - book two's Cloud Sync says the book is kept with its series, and its folder is saved as the series' file;
  - book one, reloaded, shows the same folder up to date, and its chip says *Backed up*;
  - a newer copy written to the folder by another device is loaded with the series' line in the preview;
  - an edit afterwards is saved to the series' file by auto-save.

## Mutants

In a worktree, each gated on `tsc -b`, `eslint` and a `grep` that it landed, run against `seriesFolderSync`,
`folderSyncRoundTrip` and `folderSyncState` (unit) or `e2e/seriesSync.spec.ts`.

- **At 49c3065, 23 mutants: 19 killed, 3 did not build, 1 survived.**
  - Killed:
    - the key as the book itself;
    - the version without the books, or without their seqs, or a series read as a world;
    - the state, a save or a load recording the world's seq;
    - adoption giving nothing, recording no version, or keeping the book's file name;
    - a file of another series loaded;
    - the preview of the series alone;
    - on the panel: the book's own folder, the book's file name, a load read as the book's;
    - on the chip: the book's binding, the book's state;
    - in the auto-save hook: the book's binding, a save as the book.
  - Did not build: three each left an import or a binding unused. They were rewritten and run again below.
  - **Survived: auto-save reading the book's state** (*Found on the way*). The decision moved into
    `autoSaveToFolder`, and the two hook mutants above went with the code they mutated.
- **At ae95fc7, 8 mutants, every one killed:**
  - the three rewritten: the book's own binding kept on adoption, a series' file written as a world's, a series'
    file loaded as a world's;
  - on `autoSaveToFolder`: the book's state, a save as the book, another device's copy written over, a conflict
    written over the folder's file in place of a side copy;
  - the hook given no binding, against the e2e.

So 25 mutants stand against the code as shipped, and all 25 are killed.
