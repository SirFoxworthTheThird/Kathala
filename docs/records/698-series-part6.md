# A series bible, part 6: reading a later book (issue #698)

**Plan:** `series-bible-plan.md`, part 6, with D-3 (c), *the reader says*, and (a) as the answer offered first.
**Code:** `metEarlier` and the gate in `src/db/hooks/useReading.ts`, `metIn` in `src/lib/seriesAppearances.ts`,
`src/features/worlds/EarlierBooks.tsx`, and `World.readEarlierBooks`.

## What it does

- **The question.** Opening book two or later of a series in reading mode asks once: *Have you read the earlier
  books?* **I have read them** is offered first, and closing the dialog takes it. The answer is kept on the book, so
  it travels with it, and can be changed under *Reading mode* in the book's Settings. A first book, and a book on its
  own, do not ask.
- **Read**, and everyone and everything the earlier books met count as met before this book's first scene. That
  covers each person on stage, on the phone or as a point of view, or with a state recorded; each item on a scene or
  held, placed or in a condition; each place a scene is set in or whose state is said; and each region whose state is
  said. Until the reader answers, it is read as yes.
- **Not read**, and the book keeps them back until it meets them itself, as a first book does, so nothing from the
  earlier books gives their endings away.
- **Where.** The reading gate already decides, for every list, picker, map and search, who has been met by the
  cursor. The earlier books' meetings go into its first appearances at a moment before every scene (`-Infinity`), so
  everything built on them follows unchanged: a sub-map's gateway, an identity reveal, the counts of who is held
  back. An event of an earlier book cannot be placed in this one, and the gate already lets an unplaceable event
  through, so a lore page or a fact tied to book one's scenes is shown to a reader of book two either way.

## Found on the way

- **The setting snapped back**, as part 4's mark had: the checkbox showed the stored answer until the write came back.
  It shows what was ticked at once.

## Tests

- `src/lib/__tests__/seriesAppearances.test.ts`, 1 new: what a set of books met, regions included.
- `src/db/hooks/__tests__/seriesReading.test.ts`, 4: for book three, what books one and two met, unanswered and when
  answered yes, and not book three's own; nothing when answered no; book two, only book one's; nothing for a first
  book or a book on its own.
- `e2e/seriesReading.spec.ts`, 1: a first book does not ask; book two asks, and names its place in the series; *Not
  yet*, and Anna, met only in book one so far, is kept back while Cara, met here, is shown; ticked in Settings, Anna is
  shown from the first scene, and the question is not asked again.

## Mutants

MUTANTS

## The series bible, done

With this part the plan's six are in: the series and its bible, each book opening where the one before ended, joining
an existing sequel, deletes and *in this book only*, a series' file, and reading. What is left out is said in each
part's record; the largest is folder and cloud sync, which still work a book at a time.
