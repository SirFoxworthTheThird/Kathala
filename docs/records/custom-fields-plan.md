# Custom fields on characters, places and items: the plan (issue #699)

**Asked:** let a writer add their own fields to characters, places and items, such as a mage's school, a ship's class
or a suspect's alibi. They are typed data rather than prose in the description: filterable, searchable, shown in the
Arc grid and followed over time.

## Decisions

- **D-1: fixed or over time, per field.** Each definition says which it is.
  - A fixed value is one per entity, like eye colour.
  - An over-time value is said at a scene and read at the cursor from the last scene that says it, like rank or
    loyalty.
  - A field does not switch between the two once it holds values. The editor offers the switch only while the field
    is empty, since a value at no scene and values at scenes are different things.
- **D-2: templates, taken.** Four starter sets, each added in one step. Their fields are then ordinary fields, renamed
  or deleted like any other:
  - **Fantasy characters:** *Race* (choice), *Magic* (text), *Allegiance* (link to a faction, over time).
  - **Mystery suspects:** *Alibi* (long text), *Motive* (long text), *Means* (text), *Suspicion* (choice, over time).
  - **Ships** (items): *Class* (choice), *Crew* (number, *souls*), *Captain* (link to a character, over time).
  - **Settlements** (places): *Population* (number), *Ruler* (link to a character, over time), *Founded* (date).

  A world starts with none.
- **D-3: the continuity checker knows nothing of custom fields yet.** For example, a link to someone dead at that
  scene is not flagged. That is a later issue, as the issue suggests: a field's meaning is the writer's, and the
  checker would be guessing.
- **D-4: values over time are statements of their own, not a facet of the snapshot records.** The issue suggests a
  facet of the snapshot records. That fits a person, whose records have been sparse since Part B2. It does not fit a
  place or an item:
  - Their records hold the whole state at a scene. A place's status at a scene is `''` if a record there says so.
  - Setting a field at a scene with no record would make a record, and with it a status. That is the copy Parts B1
    and B2 took out.

  So a value over time is a row of its own in a new table, `fieldValues`. There is one row for each entity, field and
  scene, and it says only that value: `{ id: fv:<defId>:<entityId>:<eventId>, worldId, defId, entityId, eventId,
  sortKey, value }`. It is read as custody is: the last row at or before the cursor, for that entity and field, by the
  entity's carry rule from `CARRIES`. A person's stays in its era; a place's and an item's cross eras, unless
  `Item.staysInEra` keeps it.
  - A value set at an earlier scene changes no later scene that says its own.
  - A value cleared at a scene is a row whose value is `null`, said there: "no longer". Clearing is not the same as
    deleting the row, which leaves the earlier value carrying.
- **D-5: in a series, the definitions are the series'.** Characters, places and items live in the series' bible, so
  their fields do too: `customFieldDefs` joins `SHARED`. Fixed values are on the entity record, so they are the
  series' as well. Over-time values belong to scenes, which are a book's, so they are the book's, as a person's
  records are.
- **D-6: types and values.** Each value is checked against its field's type when written, and anything else is
  refused. Choice options have ids, so renaming one keeps every value.

  | Type | Stored as |
  | --- | --- |
  | text, one line | a string, with no line break |
  | long text | a string |
  | number | a finite number; the unit, if any, is on the definition |
  | choice | an option id |
  | several choices | option ids, without repeats |
  | yes/no | a boolean |
  | link | an id of the definition's kind of entity: character, place, item or faction |
  | date | an `InWorldDate` (year, month, day) in the world's calendar, or ISO `YYYY-MM-DD` where it has none |
- **D-7: reading mode.** Readers see only what the book has shown them.
  - A value over time is read at the reader's position like any other state, so a later scene's value is not read.
  - A fixed value is on the entity's page, which reading mode already keeps back until the reader meets the entity.
  - A link to an entity the reader has not met yet is shown as *not met yet*.

## Data

- **Dexie v68:**
  - `customFieldDefs: 'id, worldId, kind'`
  - `fieldValues: 'id, worldId, defId, entityId, eventId'`
  - `Character`, `Item` and `LocationMarker` gain `customValues?: Record<defId, value>`. Absent, as on every record
    that predates it, means none.
- **The journal:**
  - Two new entity groups, `customFieldDef` and `fieldValue`.
  - A fixed value is an update of its entity, so its undo is the entity's.
  - Deleting a definition deletes its values, the fixed and the over time, in one transaction with tombstones, so undo
    brings all of it back.
- **`.pwk`:**
  - Both tables travel, and merge by id, deletions included.
  - A file without them imports as none.
- **Deletes and structure, as for custody:**
  - Deleting a scene deletes its value rows.
  - Deleting an entity deletes its rows.
  - Splitting or joining scenes moves the rows with the prose's scene, as custody does.
  - Moving a scene recomputes their `sortKey`.

## Parts

1. **Data:**
   - the types, v68, and value checking and display (pure, in `src/lib/customFields.ts`);
   - the resolver at a scene;
   - the CRUD hooks, journalled, with the delete count;
   - templates;
   - `.pwk`, merge, tombstones, and the cascades.
2. **Defining and editing:**
   - the *Custom fields* section in World settings: add, rename, reorder, type, options, unit, link kind, over time,
     delete with its count, and templates;
   - values on the entity pages, fixed and at the cursor, for characters, places and items.
3. **Where values show:**
   - Search;
   - the roster filtered by a choice field;
   - the Arc grid, a row for a field over time;
   - the Writer's Brief for the scene under the cursor;
   - reading mode as D-7 says.
4. **e2e, mutants, the guide** (a *Custom fields* section, and the Characters, Maps and Items sections), the record,
   and the PR.
