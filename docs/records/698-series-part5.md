# A series bible, part 5: a series' export, import and merge, whole (issue #698)

**Plan:** `series-bible-plan.md`, part 5. **Code:** `collectSeriesData`, `exportSeries`, `serializeSeries`,
`readSeriesFile` and `importSeriesData` in `src/lib/exportImport.ts`; *Export series* and `SeriesImportDialog` in
`src/features/worlds/SeriesCard.tsx`; the shelf's import in `WorldSelectorView.tsx`.

## What it does

- **A series' file** is one `.pwk` of a new kind (`type: 'series'`):
  - the series itself, its bible: the cast, items, places and maps, factions and lore its books share;
  - each book as stored, in reading order, keeping its series and its place in it, with none of the bible;
  - every image once, after the rest.

  On the way in, each image goes back to the part whose `worldId` it carries, so replacing a book never deletes an
  image the series' part has just written. Tombstones travel in each part: the bible's deletions in the series' part,
  each book's in its own.
- **Export series**, on the series' card, saves it. A book's own export is unchanged: it still goes out on its own,
  as part 1 made it.
- **Bringing one in.** The shelf's import knows a series' file:
  - into a library without the series, it comes in as it was;
  - over the series it is a copy of, the shelf asks: **Merge** or **Replace**.

  Either way it is one transaction over every table, so a page closed part-way leaves the library as it was. The series
  comes first, then each book, each applied by the world import there already is. Those calls are let past the guard
  that refuses a file over a series or its book, and only they are.
  - **Replace** makes the series the file's: its bible and each book are replaced, and a book of the series here that
    the file has not got is deleted.
  - **Merge** merges each part as a world's file is merged. Newer edits win and what only one side has is kept. What a
    tombstone says was deleted is deleted here: a character from the bible, a scene from a book.
- **A book of the file that is here as something else**, on its own or in another series, stops the import, which
  names it, before anything is written. A file whose book names another series is not read as this one's.

## Not in this part

Folder sync and cloud sync still work a book at a time. A book of a series pushed to a folder goes out on its own,
and bringing it back over the book is refused, as since part 1. A series kept in step through a folder would sync the
series' file instead; that is not built.

## Tests

- `src/db/hooks/__tests__/seriesFile.test.ts`, 7:
  - the file: the bible once, books as stored with none of it, each image with its part; each part's tombstones;
  - brought into an empty library: the series, its books in order, bible, images, and book two opening on book
    one's end;
  - replacing: the bible restored, and a book only here deleted;
  - merging: a newer name here kept, a character and a scene the file deleted deleted here, and a book only here kept;
  - refused: a book of the file here on its own, with nothing written; a file not a series, or with a book of
    another, not read.
- `e2e/seriesFile.spec.ts`, 1: exported from the card as one file; brought in over itself, the shelf asks;
  **Merge** keeps a newer name; **Replace** puts the file's back; brought into an empty library, nothing asked, the
  series and its two books.

## Mutants

MUTANTS

## Not yet

Part 6 of the plan: reading mode (D-3).
