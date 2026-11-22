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

## Tests

## Mutants
