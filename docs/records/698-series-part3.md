# A series bible, part 3: joining a book to a series (issue #698)

**Plan:** `series-bible-plan.md`, part 3. **Code:** `src/lib/seriesJoin.ts` (what is offered, what follows, how a row
is rewritten, what a copy adds), `joinSeries`, `joinOffers` and their hooks in `src/db/hooks/useSeries.ts`, and
`src/features/worlds/JoinSeriesDialog.tsx`.

## What it does

- **Join a series**, on a book's card once there is a series on the shelf, makes a book written on its own, or a
  sequel made with *Start a sequel*, the last book of a series.
- **The book's copies are matched, and the writer confirms.** Start a sequel copies the cast, items, factions and maps
  under new ids and keeps no link to what it copied, so a copy can only be known by its name and kind. Each of the
  book's people, items, maps, places, routes, regions, travel modes, factions, lore categories and pages is offered the
  series' records of the same kind and the same name: case, accents and runs of space do not tell two apart, and a
  person is also matched by an alias, either way round, after a match by name. One is suggested where it is the only
  best match and not already the suggestion for another copy. The writer keeps it, chooses another of the candidates, or
  says *Not a match*. Two copies taken for one record, or a pair the offers do not allow, are refused.
- **What follows from the pairs:** a relationship between two matched people, a membership of a matched person in a
  matched faction, a stance between two matched factions, and a map label with the same words on a matched map, are the
  series' own where it has them (a relationship either way round). Otherwise they join it.
- **Every reference is rewritten, in one transaction.** Every row the book has, in every table, is read and every id
  of a matched copy in it pointed at the series' record. That covers a field holding one, a list of them, a nested
  point, an object's key, and an id inside a longer string: a custody statement's own id
  (`custody:<item>:<scene>:<holder>`) and a dismissed warning's (`dead-in-event-<person>-<scene>`). A row whose own id
  changes is put under the new one and the old removed. The copies are removed.
- **A copy fills what the series' record left empty:** description, notes, a lore page's body, the picture and the
  colour. Its aliases and tags are added. The series' own word stands everywhere else, and nothing that names a scene
  (a relationship's start, a lore page's *visible from*) is brought over: those name the book's scenes.
- **The rest joins the bible:** the book's shared records not matched move to the series, with the pictures the
  series' records now show; a picture only a removed copy showed is deleted. A deleted shared record's tombstone goes to
  the series, so a merge does not bring it back; the book's own stay the book's. The book's journal is reset, since its
  operations name the copies and an undo would bring one back. The book goes at the end of the series.

## Why ids inside strings are rewritten

Ids are nanoids: 21 characters of `A-Za-z0-9_-`. Two kinds of stored string carry them inside: a custody statement's
id, by which `sayCustody` finds the statement at a scene to replace, and a dismissed warning's, by which the Continuity
Checker knows not to say it again. Left as they were, the first would leave two statements of one hand-off at a scene
after the next edit, and the second would bring back every warning the writer had dismissed. An id is rewritten inside
a string where it stands between characters other than letters and digits. A hyphen is allowed beside it, since a
warning's id joins its parts with one, and a 21-character random id is not found inside another string by chance. An
id shorter than 16 characters, as tests make, is rewritten only where it is the whole string, so a word containing it
is left alone.

## Found on the way

- **The dialog's suggestions came from a read made while it was closed.** The live query for the offers returned an
  empty list while the dialog was shut, the suggestions were taken from that, and every copy opened at *Not a match*.
  Each read now carries the book and series it was read for, and is used only when they are the dialog's.
- **A boundary that excluded hyphens missed the warnings.** The first rule for an id inside a string treated `-` as
  part of an id, as nanoid does, and so never found the person in `dead-in-event-<person>-<scene>`. The pure test of a
  dismissed warning found it.
- **"The Salt Books’s Wren"**, in the screenshot. The options say *Is the series’ Wren* and *Is Anna Vell, by another
  name*.

## Tests

- `src/lib/__tests__/seriesJoin.test.ts`, 16: what is offered (case, accents and spacing; alias either way, after name;
  only a person by alias; two of a name offered and neither suggested; one record suggested once; a lore page by title,
  kinds not crossed); what may be confirmed (taken twice, not a candidate, not the book's); what follows (relationship
  either way round, membership, stance, label; a half-matched pair is not); a row rewritten (every shape of reference;
  a short id only whole; not inside a longer id; bytes and dates left); what a copy adds.
- `src/db/hooks/__tests__/seriesJoin.test.ts`, 8, on a sequel made with `createSequelWorld` from book one, written in,
  then joined to the series book one became: the offers; every reference pointed and the copies removed (the scene's
  cast, place and point of view, a person's state and place on the map, a custody statement under its new id, a
  dismissed warning); a copy filling blanks, with its picture; a copy not confirmed joining beside its namesake; the
  book second in the series, its journal reset, opening on book one's end; tombstones; a refused join writing nothing;
  a book of a series or a series not joined.
- `e2e/seriesJoin.spec.ts`, 1: Join a series absent before a series exists and offered after; Anna and Bo offered, Cara
  not; Bo said not a match; the book in the series' card; one Anna, two Bos and Cara in the store, the scene naming the
  series' Anna; and Anna, dead at the end of book one, opens book two dead.

## Mutants

35 mutants, in a worktree at d7bf4b1, each gated on `tsc -b`, `eslint` and a `grep` that it landed: 30 on the join's
logic and its transaction, run against both `seriesJoin` tests and `series.test.ts`; 5 on the dialog and the card, run
against `e2e/seriesJoin.spec.ts`. **Every one is killed.**

- **33 killed on the first run.** Among them: names compared with case, accents or spacing; aliases ignored, or used
  for an item; an ambiguous match suggested; one record suggested twice; aliases weighed before names; a pair that is
  not a candidate, or a record taken twice, let through; a relationship's ends compared in order; an object's keys,
  ids inside strings, or the boundary around them left alone; a copy overwriting the series' words; the copies kept;
  the shared records left in the book; a re-keyed row's old key kept; the pictures, the tombstones or the journal left;
  the book given the last book's place; a book of a series joined; the suggestions read while the dialog was closed;
  *Not a match* ignored; the list of new records unsaid; and Join a series offered with no series to join.
- **2 did not build** the first time: a comparison TypeScript knew could not be true, and an import left unused. Each
  was rewritten so that it builds, and killed.

## Not yet

The book always goes at the end of the series; a prequel cannot yet be put before. Parts 4 to 6 of the plan.
