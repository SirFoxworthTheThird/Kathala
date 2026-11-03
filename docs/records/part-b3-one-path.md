# Part B3: one write path, one resolver

`next-plan.md`, Part B3, after B1 (item custody as statements) and B2 (a person's state as sparse statements). What B3 adds is not new behaviour, but the shape that keeps B1 and B2 true: one way to write a person's state, one way to read what is true at a scene, and a source rule holding each.

## One write path: `sayPerson`

`sayPerson(worldId, characterId, eventId, said, options)` is the write of a person's state (`src/db/hooks/useSnapshots.ts`).

- **The scene is its own argument.** A resolved state from an earlier scene cannot carry that scene into the write. This was CLAUDE.md's "a resolved snapshot is not a record at this scene", a mistake made four times, each fixed with one word. In app code it is now a signature rather than a rule.
- **`said` is only what the act says** (`PersonSaid`). No caller builds a whole state from the one before to spread into the write.
  - The quick form says its three answers (`quickStateSays`; `quickStateWrite` carried the rest of the state before).
  - A move or a placement says the place.
  - A fate says whether they live.
  - The map's character panel says the one field changed.
- **`upsertSnapshot` takes a whole state and calls it**, for tests and bulk writers holding one.

On the way, two writes that had been wrong all along:

- **The map AI import said `isAlive: true`** wherever no record was at the scene, which revived the dead. It now says the place only.
- **The checker's move fix** carried the whole state; it now says the place only.

**The rule** is `src/lib/__tests__/personWrites.test.ts`:

- No app code calls `upsertSnapshot`.
- Only the listed files write the table directly, each with its reason: the write path itself, the import, the chapter AI import and the sequel (bulk writers past the journal), and the cascades of a delete.
- An allowlist entry no file needs fails too. The first run found one: the migrations write through `tx.table(…)`.
- Both rules were killed by a mutant: an `upsertSnapshot` back in the onboarding step, and a `.modify` in `useCharacters`.

## One resolver: `stateAt`

`stateAt(world, sceneId, story)` (`src/lib/stateAt.ts`) reads what is true at a scene for every kind given: people (facet by facet, holding what custody says), custody's holdings, item conditions, places, relationships and map regions. One entity is read with `personAtScene`, `itemAtScene`, `placeAtScene` and `personRecordAt`. A write's starting state is read with `recordBefore`.

- **Each kind's carry rule is chosen once**, in `CARRIES`. It used to be chosen in five hook files.
- **The hooks' selectors read through `stateAt`:** item, place, relationship and region states, and people. So do `stateBefore` and the header's `recordBeforeIn`.

**The rule** is `src/lib/__tests__/oneResolver.test.ts`:

- `stateEngine`'s lookups (`lastKnown…`, `lastBefore`) are imported only by `stateAt`, `personState` and `custody`.
- `personAt` and `peopleAt` are imported only by `stateAt`.
- A mutant putting `lastKnownRecords` back in the map regions hook turns it red.

**Tests.** `stateAt.test.ts` covers each kind by its rule across two eras, and custody for people at a scene and with none. A mutant carrying places as a person's state turns it red.

### A count B2 had left behind

Withdrawing a record says how many later scenes "read from" it (`withdrawalOutcome`). It counted the scenes whose last record it was, which stopped at the next record. Since B2 that next record may say only a wound and read the place from this one. It now counts every later scene whose reading changes, plus those it anchors, from the records as stored (`usePersonRecords`). The records read whole would hide the change.

- A unit test covers this, and `e2e/withdrawState.spec.ts` checks it through the dialog.
- A mutant that hands the dialog the whole records turns the spec red.
- The guide's withdrawal paragraph says so.

## What is left

- **The B1 ambiguity list** (two people taking one item at one scene) is still not shown to the writer.
- **Writes of the other kinds** (place, item and relationship states) still take a whole record, `upsertLocationSnapshot` and the rest. They hold no copies of other kinds' fields, so they never had the person-state problem, and the rule does not cover them.
