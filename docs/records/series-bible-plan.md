# A series bible: the plan (issue #698)

**Issue:** #698, part of #696. **Status:** step 0, measured.

**Taken, by the owner:** D-1 (a), D-2 (a), D-3 (c), D-4 (a), each as proposed.

## What the code assumes today, measured

Every record belongs to one world by its `worldId`, and is read by it. Counted in `src/` outside the tests:

| Kind | Tables | Reads by `worldId` | Write sites |
|---|---|---|---|
| The cast | characters, relationships | 39 | 17 |
| Things | items | 20 | 8 |
| Places and maps | mapLayers, locationMarkers, mapRoutes, mapRegions, mapAnnotations, travelModes | 58 | 44 |
| Factions | factions, factionMemberships, factionRelationships | 25 | 21 |
| Lore | loreCategories, lorePages | 17 | 13 |
| **What a series would share** | 14 tables | **159** | **103** |
| Per scene | characterSnapshots, itemCustody, and the other snapshot tables | 30 and more | — |
| The book | timelines, chapters, events, sceneTexts | 79 | — |

Three more seams assume one world:

- **The journal** (`useOperations.ts`) numbers each world's operations on its own (`[worldId+seq]`), and undo
  walks one world's stack. An edit to a shared character has to be undoable from whichever book it was made in.
- **Export and merge** (`exportImport.ts`, `collectWorldData`, 6 callers) gather one world's rows by `worldId`, and
  tombstones are a world's.
- **The time cursor** (`stateAt.ts`) reads one world's records against one `Story`: its scenes in book order, its
  timelines in eras, its clock. Nothing reads across worlds.

**Start a sequel** (`sequel.ts`) forks: it copies the cast, items, factions and maps under fresh ids and keeps no
link to what it copied. Joining a sequel to its first book is therefore a matter of matching by name and kind, with
the writer confirming each pair.

## The decisions

### D-1: where the shared bible lives

- **(a) A series record holds the bible.** A series is a world of its own kind (`World.kind = 'series'`), shown on
  the shelf as the series, not as a book. Each book points to it (`World.seriesId`). The 14 shared tables' rows
  carry the series' id as their `worldId`. A book reads them through one function, `bibleOf(worldId)`, which gives
  the series' id for a book in a series and the book's own otherwise. Making a series moves the first book's shared
  rows to the series in one transaction.
- **(b) The first book holds the bible.** Like (a), but nothing moves: the shared rows keep book one's id, and later
  books point at book one. Making a series writes one field. But book one becomes special: deleting it, exporting
  it alone, or undoing in it reaches the whole series.
- **(c) Shared rows carry a `seriesId`** beside their `worldId`. Every one of the 159 reads becomes "this book's, or
  this series'", a compound query, and each write has to choose.
- **(d) Linked copies**, each book keeping its own and a sync keeping them in step. Reads stay as they are, but the
  drift the issue is about comes back with every sync that misses.

**Proposed: (a).** One record per entity, and one owner that is neither book. The 159 reads change in one way: the id
they read by goes through `bibleOf`, and a source rule (as `snapshotWriteScenes.test.ts` does for writes) fails a new
read of a shared table by a book's own id. The journal and tombstones of shared edits are the series'. A book's undo
reads its own stack and its series', in time order.

### D-2: what carries from one book into the next

- **(a) Each book opens on the last state of the book before.** For each shared entity with no record yet in this
  book, the resolver takes its state at the end of the previous book as a record before this book's first scene:
  alive or dead, place and travel, what they carry (custody), each item's condition, each place's and region's
  state. It is computed when read, so a correction in book one shows in book two at once. A relationship's state
  stays in its book. Each book keeps its own clock, eras and order.
- **(b) One story across the series.** Every book's scenes in one order, and every earlier book's records read with
  this one's. Exact, but every reader of per-scene records loads the whole series, and the clocks and eras of two
  books have to be made one.

**Proposed: (a).** It is the issue's own rule ("their last known state in book one, unless book two records
otherwise"), and the change sits in one place: the records `stateAt` is given. *The end of a book* is its last scene
in book order. A relationship's state stays with its book, because a book often opens a relationship again; say if
it should carry.

### D-3: reading mode in a series

A reader of book two may not have read book one.

- **(a) Earlier books count as read.** In book two, everyone and everything book one introduced is known from the
  first page.
- **(b) Each book on its own.** Book two hides what it has not introduced yet, as it does now.
- **(c) The reader says**, once, when opening a later book: *I have read the earlier books*, or not.

**Proposed: (c),** with (a) as the answer already chosen. A companion that shows book one's ending to someone who has
not read it spoils it; one that hides a character the reader knows well gets in the way.

### D-4: a character made in a later book

- **(a) Shared, unless marked.** A character, place or item made in book two is in the series' bible, and so in book
  one's cast lists too. A mark, *in this book only*, keeps it out of the others.
- **(b) This book's, unless shared.** Made in book two, it is book two's, and *Share with the series* moves it.

**Proposed: (a).** It is what the issue's criteria say, and a cast is a series' more often than a book's. Book one's
lists show where each entity first appears, so a character from book three does not read as forgotten in book one.

### Not a decision: what is shared and what is a book's

From the issue, and the tables:

- **Shared:** characters, relationships (the pair, not its state), items, map layers, places, routes, regions,
  annotations, travel modes, factions, memberships, faction relationships, lore categories and pages; custom fields
  once #699 is done.
- **A book's own:** timelines, chapters, scenes, prose and every per-scene record (the snapshot tables, custody,
  placements, movements); a character's goals, knowledge facts and reveals, plot threads, motifs, notes, tasks,
  drafts, and the writing log; and the World's own settings: calendar, theme, targets, export choices.

Say if any of these should move. A calendar shared by a series is the likeliest.

## The parts, once decided

1. **The series and its bible** (D-1): `World.kind`, `World.seriesId`, a Dexie `.version(67)`. `bibleOf`, and every
   read and write of the 14 tables through it, with its source rule. Making a series from a world.
2. **Reading across books** (D-2): the opening state from the book before, and the Continuity Checker's series run
   (dead at the end of book one, alive in book two, no revival).
3. **Adding a book, and joining a sequel**: a new book in the series; an existing world, or a sequel made with
   *Start a sequel*, joined with each match offered and confirmed, references re-pointed, the copies removed.
4. **Edits, deletes and undo across the books:** the delete prompt naming the books an entity appears in (D-4's
   *first appears*), and undo of a shared edit from any book.
5. **Export, import and merge** of a series whole, with its tombstones.
6. **Reading mode** (D-3), the guide's Series section, and Start a sequel's.

Each part keeps the usual process: tests, mutants, the guide, a record, both suites, and a PR.

## Not measured

- How long a book's screens take with the bible in another world. The shared reads are the same queries on another
  key, so no change is expected; part 1 measures it on the Library's largest book.
