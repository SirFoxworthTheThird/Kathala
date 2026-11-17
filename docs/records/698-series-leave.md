# Out of a series: taking a book out, dissolving a series, and an import that keeps to its own (issue #698)

**Asked for after the plan's six parts were in:** a way to take one book out of a series, and to remove a series
while keeping its books as they are. **Decided:** a book that leaves takes a copy of *everything* the series shares,
except what is kept to another book, rather than only what its scenes name. Nothing is lost, and what is not wanted
can be deleted after.

**Code:** `planLeave` in `src/lib/seriesJoin.ts`; `leaveSeries` and `dissolveSeries` in `src/db/hooks/useSeries.ts`;
`ownIds` in `src/lib/exportImport.ts`; the series card (`SeriesCard.tsx`).

## Found first: a workaround that emptied a series

The way out a writer would reach for was this: export the book, delete it from the series, and bring the file back.
Measured with a probe before anything was built, it took the series' cast with it. The book's file carries the series'
cast under the series' own ids, and an import writes rows by id. So the series was left with no characters, and every
other book with none. The same happened to anyone bringing a series book's file into the library where the series
still is.

## What it does

- **Take a book out** (the arrow beside its name on the series' card, behind a confirm). In one transaction:
  1. The book leaves the series first. From then on, the shared tables' hooks keep a row written with its id as its
     own.
  2. Everything the series shares is copied for it under new ids, with the pictures those records show.
  3. What is kept to it (`onlyInBook`) moves with it under the same ids, as does a relationship or membership that
     reaches one. Its mark goes, since on its own it means nothing.
  4. What is kept to another book, and what reaches that, stays behind.
  5. Every row the book has is pointed at its copies by the rewrite that joining a series uses, run the other way:
     its scenes' casts and places, every record made at a scene, a custody statement under its new id, its notes and
     dismissed warnings.
  6. Its journal is reset, since the operations name the series' records. The books left are numbered again from one.
- **Dissolve series** (on its card, behind a confirm): each book leaves as above, then the series and its records are
  deleted, all in one transaction. Nothing in the books is lost.
- **An import keeps to its own** (`ownIds`). Before a file is written, any of its rows whose id another world already
  owns is given an id of its own. The file is rewritten to match: references, ids inside strings, and its pictures'
  ids, though not their bytes. A row of the same world by that id is its own, and is written over as before. So a
  book's file brought back in after leaving or being deleted comes in on its own, and the series keeps its cast.

## Tests

- `src/lib/__tests__/seriesJoin.test.ts`, 3 new: what moves with a leaving book (what is kept to it, and what reaches
  that), what stays behind (what is kept to another, and what reaches that), and everything else copied under ids of
  its own.
- `src/db/hooks/__tests__/seriesLeave.test.ts`, 7:
  - a book taken out has its own copy of the cast, its scene, records and custody naming it, what is kept to it moved
    and unmarked, and the series keeping its own, Dan, kept to book three, among them;
  - an edit to its copy does not reach the series, and its picture is its own;
  - the books left are numbered again, its journal is reset, and deleting the series leaves it whole;
  - a book not in a series is refused;
  - a dissolved series leaves each of three books with its own Anna, whom its scenes name;
  - a book's file brought back in after deletion takes none of the series' rows or pictures;
  - a world's file over itself keeps its ids.
- `e2e/seriesLeave.spec.ts`, 1: book two taken out from the card stands on the shelf on its own with its own Anna; the
  series dissolved leaves book one on its own with Anna as she was.
- Three existing specs looked a book's button up by `/The Second Road/`, which now also names *Take The Second Road out
  of the series*. Each now matches the book's own row.

## Mutants

20 mutants, in a worktree, each gated on `tsc -b`, `eslint` and a `grep` that it landed: 18 on the plan, the leave,
the dissolve and the import, run against the leave and join tests, the series tests, and the export and merge tests
already there; 2 on the card, run against `e2e/seriesLeave.spec.ts`. **Every one is killed at abdaa9c.**

- **19 killed on the first run.** Among them:
  - in the plan: what reaches a moved record not moving, nothing left behind, and moved records copied;
  - in the leave: the book left in its series, its pictures shared or not written, its mark kept, its rows not
    pointed at its copies, a re-keyed row's old key kept, its journal kept, and the books left not renumbered;
  - in the dissolve: the series kept, and the books not leaving;
  - in the import: nothing re-id'd, a world's own rows re-id'd, the guard off, and pictures keeping colliding ids;
  - on the card: *Take it out* and *Dissolve* doing nothing.
- **1 survived, and is killed by a test written for it:** a record kept to another book copied by the book leaving.
  The test series had nothing kept to another book; now Dan is kept to book three, and stays the series' when book
  two leaves.
