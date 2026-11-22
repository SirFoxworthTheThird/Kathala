# Custom fields on characters, places and items (issue #699)

**Asked:** let a writer add their own fields to characters, places and items, such as a mage's school, a ship's class
or a suspect's alibi. They are typed data rather than prose in the description: filterable, searchable, shown in the
Arc grid and followed over time. The decisions are in `custom-fields-plan.md`, D-1 to D-7.

**Code:**
- `src/types/customField.ts`: the field, its value, and a value over time.
- `src/lib/customFields.ts`: values checked and shown, the templates, and what a search finds. Pure.
- `src/lib/stateAt.ts`: `fieldsAt` and `fieldCarries`, a value over time read at a scene by its entity's rule.
- `src/db/hooks/useCustomFields.ts`: the hooks and every write, journalled.
- `src/features/worlds/CustomFieldsSettings.tsx`: the World settings section.
- `src/features/customFields/`: the panel on the entity pages, and the roster filter.
- Search, the Arc grid's *Fields* view and the Writer's Brief read them where they are.

## What it does

**Fields.** World settings has a *Custom fields* section, with a list for each kind: characters, places and items.
- A field has a name and a type: text, long text, number (with a unit), choice, several choices, yes or no, link (to a
  character, place, item or faction), or date.
- It is fixed, one value each, or changes over time, said at a scene and read at the cursor (D-1).
- Fields can be moved, renamed and given more choices. Renaming a choice keeps every value that picked it, and
  taking one out takes it out of those values.
- A field that holds values keeps its type, its link kind and whether it changes over time. An empty one can
  change them.
- Deleting a field says first how many values go with it, on records and at scenes. One undo brings the field and
  all of them back.
- Four templates (D-2): *Fantasy characters*, *Mystery suspects*, *Ships* and *Settlements*. A template adds only
  the names its kind hasn't got.

**Values.** A character's Overview, an item's page and a place's panel show the entity's fields.
- A fixed value is edited where it stands, and kept on the entity's record (`customValues`).
- A value over time is shown at the scene under the cursor, with where it comes from: *said here*, or *since Ch. 3 —
  The Ford*. Changing it says it at this scene. *Take back* removes what this scene says, so the value before holds
  again. An empty value says it no longer holds from here.
- A value is checked against its field's type, and anything else is refused with why (D-6). A link must name a
  record of its kind.
- A value over time is a row of its own (`fieldValues`, D-4), read as custody is: the last at or before the scene,
  by the entity's carry rule. A person's stays in its era; a place's and an item's carry, unless the item is kept in
  its era.

**Where they show.**
- **Search** finds a value as it reads, a choice by its label and a link by its name, and says the field: *Race:
  Wood elf*. A value over time is searched as it holds at the cursor.
- **The Characters and Items rosters** filter by a choice field. One over time is read at the cursor.
- **The Arc grid** has a *Fields* view: a row for each person and field over time, a cell for each column, bold where
  the column says it.
- **The Writer's Brief** lists *Fields at this scene* for the people and items in it and the place it is set, and
  anything the scene says of anyone else, marked *changes here*.

**Reading mode** (D-7): a value over time is read at the reader's position; the pages are those the gate already
shows; a link to someone the reader has not met reads *not met yet*. Nothing can be edited.

**Carried with the book.**
- Both tables travel in a `.pwk` (file version 22) and merge by id. A field deleted on one device is deleted on the
  other with its values, by tombstones. A file without them imports as none.
- A value goes with the scene, the entity and the world it is on. A scene join keeps the later scene's word, on the
  joined scene. A scene moved has its values rekeyed.
- **In a series** the fields are the series' (D-5) and a value over time is its book's. Each book opens on the values
  the one before ended with. A book leaving takes its own copy of each field, its values pointed at the copies. A
  book joining brings what its matched copies say, links pointed at the series' records.
- **A sequel** copies every field under a new id. A value comes with what it is on, and a link only where what it
  names came too. With an opening chapter, each value over time comes as book one ended it.

The Continuity Checker knows nothing of custom fields yet (D-3).

## Found on the way

- **A field has no place in a series join's matching.** A book joining a series brings its fields into the series'
  bible as they are, so the series can have two fields called *Race*. Matching fields would mean matching their
  choices too, by label, and the writer can delete one of two. It is left for when a writer meets it.
- **A value typed and left at once.** A fixed text or number is written when the box is left. The e2e left the page
  straight after pressing Enter, and the write had not landed. The spec now waits for the record; a writer leaves a
  box before the page.

- **Two tests were weaker than they looked**, and two surviving mutants showed it:
  - The search test put a stale fixed value beside a value over time for the same person, so a search falling back to
    the fixed value had nothing to fall back to. It now has a person with only the stale fixed value.
  - The series-join test checked its links with `arrayContaining`, which one match satisfies. A link left on the
    sequel's removed copy of the Guild passed. It now requires every link to name the series' own record.
- **The Arc grid showed nothing for a book with only custom fields.** It said *No snapshots yet* until someone had a
  recorded state, so a book tracked only by fields over time had no grid. A field value now counts.

## Tests

- `src/lib/__tests__/customFields.test.ts`, 16:
  - **values checked:** text one line and long text any; a finite number; a choice by its option, several without
    repeats; yes or no; a link by its shape; a date in the calendar's month lengths, or a real ISO day without one;
    and no value always allowed, as a clear;
  - **values shown:** a number with its unit, a choice by its label, a link by its name, a date in the calendar or
    as a date; and nothing for an option taken out, a link to what is gone, or no value;
  - **shapes:** a name, choices for a choice, a kind for a link;
  - **templates:** the four of D-2, and only the names a kind has not got;
  - **read at a scene:** the last said by then; an earlier value not reaching a later scene's own; `null` said; the
    carry rules for a person, a place, an item and an item kept in its era; a field that is gone not read;
  - **search:** a fixed value and one over time as they read, never an option id, a link id or a stale fixed value
    under a field over time, and nothing for a link that shows nothing.
- `src/db/hooks/__tests__/customFields.test.ts`, 15, against the real hooks:
  - a field made, ordered and reordered with undo; a template added once, as one undo;
  - a fixed value checked, kept, cleared and undone; each refused for the other kind of field;
  - a value over time said, not repeated, cleared, taken back and undone, and refused for two lines;
  - its cascades: scene, chapter, timeline, item, place, character and world; a join keeping the later scene's word;
    a move rekeying it;
  - a field's type kept while it holds values; a choice renamed keeping values and taken out of them, in one undo;
  - a field deleted with its values and tombstones, the count first, and one undo bringing all of it back;
  - a `.pwk` round trip, a file without the tables, a file with one malformed, and a merge with deletions;
  - a series: the fields the series', a book's opening, a field deleted across books, a book leaving with its own
    copies, and a sequel joining with its links pointed at the series' records;
  - a sequel: new ids, values with what came, links only where what they name came, and the values over time it opens
    on.
- `src/lib/__tests__/stateAt.test.ts` and `src/db/hooks/__tests__/seriesOpening.test.ts`: a moment and an opening now
  carry `fields`.
- `e2e/customFields.spec.ts`, 3:
  - **a writer:** a template and a field by hand; a fixed value and a value over time set on a character's page, said
    here and carried to the next scene; kept over a reload; a field deleted with its count said; a field holding values
    locked and an empty one not;
  - **a reader:** a value over time read at their place, a captain not met yet as *not met yet*, a later scene's word
    not read, and nothing to edit;
  - **where they show:** the roster filtered by a choice; Search finding a choice by its label and a value over time
    only where it holds; the Arc grid's *Fields* rows, said and carried; the Writer's Brief, *changes here* and not.

## Mutants

In a worktree, each gated on `tsc -b`, `eslint` and a `grep` that it landed: 32 against the unit and hook tests, and
10 against `e2e/customFields.spec.ts`.

- **At 9b0425f, 13 mutants:** 10 killed, 1 survived, 2 did not build. The run stopped there: one mutant's `\u0000`
  became a null byte in the shell command.
  - Survived: search reading a fixed value under a field over time. The test is stronger now (*Found on the way*).
  - Did not build: each left a binding unused. They were rewritten.
- **At 0859559, the rest and the rewritten, 23 mutants:** 19 killed, 1 survived, 3 did not build.
  - The search mutant killed by the stronger test.
  - Survived: a series join not pointing a copy's links at the series' records. That test is stronger now too.
  - Did not build: 3, one narrowing a type to `never` and two leaving a binding unused. They were rewritten.
- **At 152b4f3, 4 unit mutants:** the three rewritten and the join mutant, all killed.
- **At 152b4f3, the 10 against the e2e spec:** 8 killed and 2 did not build, both rewritten and then killed:
  - a reader given editors; *not met yet* never said; *said here* never said; a field holding values never locked;
  - a roster filter keeping everything; Search with no field values; Search reading values over time from the whole
    book;
  - the Arc grid showing a carried value as said, and hiding a book with only fields; the Brief marking everything
    as changing here.

42 mutants stand against the code as shipped, and every one is killed.
