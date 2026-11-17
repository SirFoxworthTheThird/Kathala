# A series bible, part 4: deletes, first appearances, and *in this book only* (issue #698)

**Plan:** `series-bible-plan.md`, part 4, with D-4 (a), *shared, unless marked*. **Code:** `src/lib/seriesAppearances.ts`
(where each entity appears, the words a delete says, `seenFrom`), `appearancesIn` and `useSeriesAppearances` in
`src/db/hooks/useSeries.ts`, the gate provider (`src/db/hooks/ReadingGateContext.tsx`),
`src/features/worlds/BookScope.tsx`, and `collectWorldData` in `src/lib/exportImport.ts`.

## Decided at the start

**Undo stays the book's own.** The plan's D-1 text said a book's undo would also walk the series' shared edits made in
other books. Part 1 had built it the other way: an edit is journalled under the book it was made in, and only that
book's Undo takes it back. Asked which was wanted, the owner kept part 1's: Undo takes back what was just done in this
book, and an Undo in book two never reaches back to an edit made days ago in book one. Nothing is changed by it; the
guide now says so.

## What it does

- **Where each entity appears**, book by book. A scene tells of a person on stage, on the phone or as its point of
  view, or with a state of theirs recorded there. It tells of an item on the scene, or whose holder, place or
  condition is said there, and of a place a scene is set in or whose state is said there. A person only mentioned is
  not counted: that is also how a reader meets them, by not meeting them. Read across the series' books in reading order,
  live.
- **A delete in a series names the books.** Deleting a shared character, item or place says which books have it, and
  how many scenes in each: *Anna appears in The Salt Road (3 scenes) and The Second Road (1 scene). Deleting removes
  them, and their states, from every book in the series.* One in no scene yet says so. Outside a series, the words are
  as they were.
- **A list says where one first appears.** In a book of a series, a character's or item's card says *First in The
  Second Road* where that book is the first to have them in a scene, and this book has them in none. D-4 put it this
  way: a character from book three should not read as one book one forgot. Read once for the list, not once a card.
- **In this book only** (`onlyInBook` on a character, item or place) keeps one out of the other books. It is applied
  where the reading gate is given to the book's screens. Every entity hook already filters through the gate, so the
  mark holds on every list, picker, map and search, including screens added later. It is offered on the
  entity's own page, only in a series. It is refused while another book's scenes have them in them, since it would hide
  them from scenes that name them. A name typed in another book's scene header still finds them: the mark is about lists.
- **A book's export** leaves out what is kept to another book, and any relationship or membership that reaches one.
  The file is that book on its own, so the mark itself is dropped from it.

## Found on the way

- **A card per live query.** The first cut had each card read the series' appearances itself, so a cast of fifty
  read every book fifty times. The roster reads them once and gives each card its line.
- **A redundant check in the export**, found by a surviving mutant: see below.
- **The mark snapped back.** The checkbox showed the stored record. Until the write came back it showed the old value,
  and a click looked as if it had not taken. It shows what was ticked at once, and is disabled while the write is in
  hand.

## Tests

- `src/lib/__tests__/seriesAppearances.test.ts`, 8: every way a scene tells of each kind; a scene counted once, and a
  record at a scene the book has not got not at all; a mention not counted; books in reading order whatever order they
  are given; *first in* beside one this book does not tell of, and not beside one it does or one no book does; the
  sentence for one, two and three books; a delete's words for a person, an item and a place, with and without
  appearances; what a book sees of the bible.
- `src/db/hooks/__tests__/seriesScope.test.ts`, 2: appearances read across two books, one of them by a recorded state
  alone; book one's export without Cara
  (kept to book two) or her relationship, and book two's with her, unmarked.
- `e2e/seriesScope.spec.ts`, 1: book one's cast says *First in The Second Road* beside Cara and nothing beside Anna;
  the mark refused for Anna, who is in book one too; ticked for Cara, who leaves book one's list and stays in book
  two's; unticked, she is back; deleting Anna names both books.

## Mutants

24 mutants, in a worktree, each gated on `tsc -b`, `eslint` and a `grep` that it landed: 18 on where each entity
appears, the words, the export and the bible's view, run against both part 4 tests and `series.test.ts`; 6 on the gate,
the hook, the mark, the delete's words and the cards, run against `e2e/seriesScope.spec.ts`. **Every one is killed at
87ccf74.**

- **18 killed on the first run.** Among them: each way a scene tells of someone left out; the books in the order they
  came; *first in* the last book rather than the first; *scene* and *scenes* confused; the last book joined with a
  comma; a book seeing what is kept to another; the gate not given the mark; the appearances never read; the mark
  offered while another book has them; the delete's plain words in a series; *first in* never said; and the mark never
  cleared.
- **1 survived, and the code it found went.** A book's export dropped a kept row by its id and, beside that, any row
  naming a kept id by any field. Removing the first check changed nothing, since a row names its own id. The redundant check
  is gone, and the mutant was replaced by one on what remains, which is killed.
- **5 did not build** the first time: unused bindings, a type lost through a `slice`, a cast TypeScript would not
  make, and a constant condition. Each was rewritten so that it builds. Four were killed. The fifth, the appearances
  read without the people's recorded states, survived. Nobody in the test had a state without also being in a scene's
  cast. Dan now does, and it is killed.

## Not yet

Parts 5 and 6 of the plan: a series' export, import and merge whole, and reading mode.
