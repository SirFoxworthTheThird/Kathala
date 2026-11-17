# A series bible, part 1: the series and its bible (issue #698)

**Plan:** `series-bible-plan.md`, part 1, with the owner's decisions D-1 (a) and D-4 (a). **Code:** `src/db/database.ts`
(`SHARED`, `bibleOf`, `inBook`, `familyOf`, the hooks), `src/db/hooks/useSeries.ts`, `src/db/hooks/useOperations.ts`
(`journalWorldOf`), `collectWorldData` and `refuseOverSeries` in `src/lib/exportImport.ts`, and
`src/features/worlds/SeriesCard.tsx`.

## What it does

- **A series** is a world of its own kind (`World.kind = 'series'`) that holds the bible its books share. A book
  points to it by `World.seriesId`, in reading order by `seriesIndex`. Dexie v67 indexes `seriesId`; no record
  changes until a writer makes a series.
- **The bible** is 14 tables (`SHARED`): characters, relationships, items, map layers, places, routes, regions,
  annotations, travel modes, factions, memberships, faction relationships, lore categories and pages. Their rows carry
  the series' id. Everything else is a book's: timelines, chapters, scenes, prose, every record made at a scene, goals,
  knowledge, threads, motifs, notes, tasks, drafts, the writing log.
- **Reads:** `bibleOf(worldId)` gives the series' id for a book of one and the world's own id otherwise. All 159 reads
  of a shared table by world go through it.
- **Writes:** a hook on each shared table moves a new or moved row's `worldId` to its bible, whatever path wrote it: a
  journalled create, a bulk import, an AI import, a section import. The images a shared entity shows are stored under
  its bible too.
- **A book's own records of a shared entity** (`inBook`): Anna has records in each book, and a read by her id finds
  every book's. Thirteen such reads are kept to the book they are made in. A delete by the entity is left as it is:
  deleting a shared character takes its states from every book.
- **Making a series** moves the book's bible, the images it shows and the tombstones of its deleted shared rows to a
  new series, in one transaction. The book's story and its journal stay with it. **Add a book** puts a new book at the
  end. **Deleting a book** leaves the bible; **deleting the series** takes every book and the bible.
- **Undo:** a shared edit is journalled under the book it was made in (`journalWorldOf`, the book open in
  `AppShell`), so that book's Undo takes it back and its Redo puts it back. The series has no screen to undo from. A
  delete's cascade is captured across the series and every book (`familyOf`), so undoing the delete of a shared
  character restores its states in each book.
- **Export:** a book goes out on its own. Its bible, the bible's images and tombstones are written under the book's
  own id, and no series is named, so the file opens anywhere as an ordinary world. A file is not brought in over a book
  of a series, or over a series: its rows, put by id, would pull the shared rows out of the series. Bringing a series
  in whole is part 5.
- **The shelf** shows a series as one card, its books in order, with **Add a book** and a delete that names the books
  it takes. A book's card offers **Make a series**. A book's dashboard says *Book 2 of The Salt Books*.

## Why `bibleOf` is synchronous

A book's shared rows are read in hundreds of places, many inside transactions that name their tables. A read of
`worlds` there would be refused. So each book's series is kept in memory: loaded when the database opens, kept by the
worlds table's own hooks as each write happens, and read again on Dexie's `storagemutated` event, which carries another
tab's writes too. Probed first: a Dexie `creating` hook does rewrite `worldId`, on `add`, `bulkAdd`, `bulkPut` and
`update`, and on the caller's own object.

## Found on the way

- **The first rewrite took deletes with it.** `deleteWorld` and the replace path of an import delete a world's rows by
  its id. Rewritten through `bibleOf`, deleting one book would have deleted its series' whole bible. They go by the
  world's own id; `bibleReads.test.ts` holds both halves.
- **Reads by entity crossed books.** `where('characterId')` used to mean one world's records. A test of mine passed for
  a wrong reason here first: it said `alive` where the field is `isAlive`, so nothing was said at all. With that put
  right, the thirteen reads were found by a scan and kept to their book.

## Tests

- `src/db/hooks/__tests__/series.test.ts`, 12: making a series (rows, images, tombstones moved; story, cover and
  journal kept; refused twice; known again after a reopen), a second book, an edit read from both, a character made in
  book two in book one's cast, a bulk write, undo of a shared edit from its book, a shared delete undone across books,
  reads kept to the book, deleting a book and a series, a book's export, an import refused.
- `src/lib/__tests__/bibleReads.test.ts`, 4: the source rule, in both halves, and that its scan finds what it looks
  for.
- `e2e/series.spec.ts`, 2: a book made a series from the shelf, a book added, a character edited in book two and read
  in book one, undone and redone there; deleting a series.

## Mutants

Running at this commit; the results will be added here when the run ends.

## Not yet

Parts 2 to 6 of the plan. Until part 2, a book opens without its predecessor's ending: a character with no record in
book two has none there. Until part 4, the delete prompt does not name the books an entity appears in, and nothing
marks a character *in this book only*. Until part 3, an existing sequel cannot be joined to its first book.
