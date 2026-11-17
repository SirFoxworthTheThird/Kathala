# A series bible, part 2: each book opens where the one before ended (issue #698)

**Plan:** `series-bible-plan.md`, part 2, with the owner's decision D-2 (a), the end of the book before. **Code:**
`src/db/hooks/useOpening.ts` (`openingOf`, `useOpening`, `withOpening`), the hooks that resolve state at the cursor
(`useSnapshots.ts`, `useCustody.ts`, `useItemSnapshots.ts`, `useLocationSnapshots.ts`, `useMapRegions.ts`),
`useBookOf` in `src/db/hooks/useSeries.ts`, and the Continuity Checker (`computeIssues.ts`, `ContinuityChecker.tsx`).

## What it does

- **A book's opening.** For a book after the first, each shared character, item, place and region starts from its
  state at the last scene of the book before: alive or dead, place and map, travel, status notes, what they carry;
  each item's holder (custody, a collective item's holders too) and condition; each place's and region's state. A
  relationship's state is not carried: a new book often opens one again.
- **Nothing is stored.** `openingOf(bookId)` reads the book before as it stands and makes records from it, at a scene no
  story has (`opening:<bookId>`) and a `sortKey` before every chapter (`OPENING_KEY = -0.5`). Every resolver then reads
  them as the earliest records, in every era, and a record the book makes overrides them from its scene on. A correction
  in book one shows in book two at once, since the opening is read again (a live query).
- **The end of a book** is its last scene in book order (`story.position`). In a book of several eras, that scene's era:
  a character only in another era's timeline at the end is not carried. A book with no scenes passes on the opening it
  was given, so book three opens on book one's end through an empty book two.
- **Reads.** `withOpening(rows, opening)` puts the opening's records before the book's own wherever state is resolved at
  the cursor: a person's state (`useCharacterSnapshots`, `useWholeAt`, `useBestSnapshots`,
  `useResolvedCharacterSnapshot`), holdings, item conditions, a place, regions. Records shown as a list (History,
  Appearances) are the book's own: the opening makes them whole and is then dropped from the list.
- **Writes.** `sayPerson` compares what is said with the state before the scene, opening included. So saying at book
  two's first scene what book one ended on stores nothing, and saying a change stores it.
- **The checker reads on.** Someone dead at the end of the book before and alive in this one is a warning that names
  the book: *Anna is alive again in Ch. 1 after dying at the end of The Salt Road*, unless the scene they return in says
  *They came back in this scene*.

## Found on the way

- **A character's screens wrote under the series.** The character tabs took `character.worldId` for the book: in a
  series that is the series' id, so Current State read no scenes and its writes would have gone to the series.
  `useBookOf(entity)` gives the book open (the route's world, then the active one). A new half of
  `bibleReads.test.ts` fails any `character.worldId`, `item.worldId` and the like in `src/features/`.
- **A query split over lines missed the rule.** `useRootMapLayerState` read map layers by the book's own id on a
  chain written over three lines, which the part 1 scan read line by line; a book in a series showed *No maps yet*. The
  scan now joins a chain before reading it, and the read goes through `bibleOf`.
- **The region panel disagreed with the sidebar, in one book too.** Its *At this moment* showed only a record at this
  exact scene, so a region contested at scene 1 showed *active* at scene 2, where the sidebar said *contested*. It
  shows the carried status now, from an earlier scene or the book before. A new test in `regionMoment.spec.ts` holds it
  within one book.
- **Two `PrematureCommitError`s.** `openingOf` runs inside `sayPerson`'s transaction. It first awaited a plain
  `Promise.resolve` for each kind not asked for, which let the transaction commit; each read is now awaited on its own,
  and only for the kinds asked. Then `sayPerson`'s scope was a non-`async` arrow returning the call, which Dexie could
  not follow; it is an `async` function now, as `inOneWrite`'s is.
- **Part 1's isolation test changed its premise.** It held that book two did not see book one's states at all. Book two
  now opens on them, so the test holds the other direction: book one does not see book two's.

## Tests

- `src/db/hooks/__tests__/seriesOpening.test.ts`, 7: a first book and a book alone open on nothing; book two opens with
  each person, holder and condition as book one ended them; at book two's first scene the state is book one's end, and
  a record overrides it from its scene on; a correction in book one shows at once; book three through an empty book; a
  write compares with the opening; a relationship's state is not carried.
- `src/lib/__tests__/computeIssues.test.ts`, 3: dead at the end of book one and alive in book two is said once, naming
  the book; nothing is said when book one ended them alive, or book two records their return; a second death and
  return in book two is its own finding.
- `src/lib/__tests__/bibleReads.test.ts`, 5 (1 new): no screen takes a shared entity's `worldId` for the book; chains
  over several lines are read whole.
- `e2e/series.spec.ts`, 1 new: Anna, dead at the end of book one, is dead at book two's first scene on Current State,
  where marking her alive offers *They came back in this scene*; saved alive without it, the checker names book one.
- `e2e/seriesOpening.spec.ts`, 2: who holds an item, a record in book two shown whole on History, and an item's
  condition (with book one's own scene shown too); a place's state and a region's on the map.
- `e2e/regionMoment.spec.ts`, 1 new: a later scene shows the status an earlier one set, until it says another.

## Mutants

27 mutants, in a worktree, each gated on `tsc -b`, `eslint` and a `grep` that it landed: 12 on the opening and the
checker, run against `seriesOpening.test.ts`, `series.test.ts`, `computeIssues.test.ts` and `bibleReads.test.ts`; 15
on the hooks and screens, each run against the e2e test that names it. **Every one is killed at ebea86c.**

- **22 killed on the first run.** Among them, the book before chosen as the first rather than the nearest, the end of a
  book taken as its first scene, an empty book passing on nothing, the opening sorted after the scenes, each kind left
  out of the opening, each screen's hook without it, the character tabs taking the entity's world, and the map layers
  read by the book's own id.
- **1 survived it**, and is killed by a test written for it: a book's own records not made whole from the opening
  (`useWhole`). Nothing read a record in book two that said only part of a state. `seriesOpening.spec.ts` now gives Bo
  a record in book two that says only that he is alive, and his History shows it with book one's *limping*.
- **4 did not build** the first time: an unused binding, a condition TypeScript narrowed to `never`, and two unused
  imports. Each was rewritten so that it builds, and killed.

## Not yet

Parts 3 to 6 of the plan. Until part 3, an existing sequel cannot be joined to its first book. Until part 4, the delete
prompt does not name the books an entity appears in, and nothing marks a character *in this book only*. Until part 5, a
series is not exported, imported or merged whole. Until part 6, reading mode does not choose how much of the books
before it shows.
