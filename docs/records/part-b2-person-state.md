# Part B2: a person's state as sparse statements — the model and its probe

`next-plan.md`, Part B2. Measured on 2026-10-26 over the Library (`/home/user/kathala-library` at 773f43c) and the writer-run worlds in `docs/records`, `e2e/fixtures` and `src/test/fixtures/worlds`.

- `src/lib/personState.ts` — the model.
- `src/lib/__tests__/personState.test.ts` — its rules.
- `scripts/person-probe.ts` (`npm run probe:person`) — the probe.

## The model

A person's record used to hold their whole state at its scene, copied from their last record for every field the writer did not touch. "Anna is at the Quay" also restated that she was alive, on foot, and had no notes. A correction at an earlier scene therefore stopped at the first later record that had copied the old value: W-2's place drift, and F2, the carry-forward toast.

Now a record holds only what its scene says, in five **facets**, each read on its own:

| facet | fields | with nothing said |
| --- | --- | --- |
| `alive` | `isAlive` | alive |
| `place` | `currentLocationMarkerId`, `currentMapLayerId` (said together) | nowhere |
| `travel` | `travelModeId` | none |
| `status` | `statusNotes` | none |
| `carrying` | `inventoryNotes` | none |

- **A field not said is absent** (`undefined`). It is not `null`: a place of `null` is "nowhere", and that is said.
- **Each facet is read as `stateEngine` reads a person.** The last record that says it, at or before the moment, in the moment's era (`personAt`, `peopleAt`).
- **The state is read at the last record**, whichever facets it says. That record gives the identity, the scene, and `revived`, which marks a scene rather than carrying. This is what "carried forward" and "recorded at this scene" already mean on screen.
- **With no moment chosen**, a person is read at their most recently updated record's own scene, as that record was shown before.
- **Screens that walk records** (history, the checker, a chapter's diff) read each record whole at its own scene (`wholeRecords`).
- **The inventory is no longer a facet.** Who holds what is custody's (Part B1).

## Making records sparse

`sparseRecords` is the migration's walk. A facet equal to the person's state before the record, in its era (`lastBefore`), says nothing and goes. So does one at a person's first record that says only what a person is with nothing said. Every scene then reads as it did, since each dropped value was the one read there anyway. A record whose scene is gone, with no stored position either, is never read, and is left whole.

**One kind of repeat is a statement.** A place said again at a scene set there, with the person in its cast, is the header placing its cast. The header does it on purpose, so that a later change to an earlier scene does not move them (W-2), and these repeats are kept. In the Library, almost every repeated place is one: 7,867 of 7,955.

## The probe

Each world is imported through the app's own import, made sparse, and read every way the app reads a person, against the whole-state records:

- **`atScene`:** a person at every scene of the book (Current State, the map, the brief).
- **`scoped`:** everybody at each scene of one timeline, among that timeline's records (the map's playback).
- **`noCursor`:** everybody with no moment chosen.
- **`whole`:** each record whole at its own scene.

| | |
| --- | --- |
| worlds | 67 |
| records | 18,529, of 1,864 people over 6,326 scenes |
| field values (5 per record) | 92,645 |
| dropped as repeats | 55,269 — alive 18,181, place 88, travel 18,505, status 215, carrying 18,280 |
| place repeats kept as the header's word | 7,867 |

| reading | readings | differences |
| --- | --- | --- |
| `atScene` | 280,136 | 0 |
| `scoped` | 136,493 | 0 |
| `noCursor` | 1,864 | 0 |
| `whole` | 18,529 | 0 |

More than half of what the records store repeats the state before it. The equivalence is exact.

### How the rules got here, measured

- **No cursor, at first, read each facet from the most recently updated record that says it.** That gave 169 people a different `alive`, 5 a different travel mode and 28 different inventory notes from what the screen shows today. It happens wherever a record at an early scene was edited after a later one. Reading the person at their latest record's scene makes it 0.
- **Two Fellowship records have no `inventoryNotes` field at all.** They read as none, which is what the screens already showed for them.
- **The probe can fail.** A mutant that drops every travel mode whether it repeats or not gave 13 differences in `atScene`, `scoped` and `whole`. Travel modes change rarely in the Library, which is why the count is small.

### Cost

Reading every person at every scene of all 67 worlds took 488 ms from whole records and 2,324 ms from sparse ones: five lookups instead of one. That is about 8 µs a reading. A screen reads one moment's cast, a few dozen people at most.

Reading a world's records whole (`wholeRecords`, which every screen that walks records goes through) is one sorted walk per person and facet. On the largest world, Little Women (2,058 records), it took 11 ms. It first took 47 ms as one `lastBefore` per record and facet, rewritten once measured. The probe's `whole` reading checks the walk against the records as stored: 0 differences.

## What was built

B2 went in as four commits, each green on its own.

1. **The model and its probe** (`src/lib/personState.ts`, `scripts/person-probe.ts`), described above.
2. **Readers read facet by facet.** The table is typed `PersonRecord`, so every raw reader has to say how it reads one.
   - `resolveCharacterSnapshot` and `selectBestCharacterSnapshots` are `personAt` and `peopleAt`.
   - The hooks return records whole at their scenes (`wholeRecords`), and so do the header's fates, the echo locations, the chapter diff, the sequel and custody's derivation.
   - Writers start from the whole state before them.
   - With no moment chosen, a state holds custody's inventory at its own scene.
3. **Records made sparse** — Dexie v62 (`sparseWorld`), and an import of a file before v19 (`ensureSparse`), after custody is derived from the inventories it takes out.
   - `EXPORT_VERSION` is 19, so an older app refuses a sparse file rather than reading a missing `isAlive` as dead.
   - `sparseRecords` compares against the whole state before, so it takes nothing from records already sparse.
   - A scene join merges a person's two records facet by facet (`joinedOnto`).
4. **Writers say what changes.** `upsertSnapshot` stores, through `toSay`, the facets that differ from the state before, those the scene already says, and those an act names in `says`: the quick form and the header's cast say the place, a fate says whether they live. It never stores the inventory.
   - The chapter AI import and the sequel make their records sparse after custody is derived (`sparseAt`).
   - **The field half of carry-forward is gone.** With no copies there is nothing to carry. Its toast, built from the records as they were before the save, would have offered to carry a change that already reaches them.

### Verified

- **The probe**, against what the import stored: the stored records are the walk's, record for record, and 0 of 437,022 readings differ (`atScene` 280,136, `scoped` 136,493, `noCursor` 1,864, `whole` 18,529). A mutant that drops every travel mode gives 13.
- **Unit tests:**
  - `personState.test.ts`: the rules, idempotence, `toSay`.
  - `personRecords.test.ts`: the migration from a raw v61 store, the import and re-export of a v18 file, a correction reaching past a later record made for something else, and a deleted scene taking back what it said.
  - `sceneStructure.test.ts`: the join.
  - The header, fate, cast, era, move and placement tests now say what a record says and what it reads as.
- **E2E:**
  - `carryForward.spec.ts` checks through Current State that a change at the first scene reaches the later recorded scenes with no offer, keeps to its era, and stops at a scene that says otherwise.
  - Specs that read a person's records read them whole, through `__pwperson` (`e2e/helpers/person.ts`), the app's own reading.
- **Mutants**, each gated on `tsc -b && eslint && grep`, all killed:
  - the import not making records sparse;
  - the migration not running;
  - the join keeping only the later record;
  - `sparseRecords` comparing against raw records (survived at first; the test then placed its "nowhere" after a record that says no place);
  - writes storing every facet;
  - the seam returning raw rows (three specs go red).

### Behaviour that changed

- **A change at an earlier scene reaches every later scene that did not say otherwise.** This includes scenes recorded for something else; there is no offer to carry it.
- **Saving Current State with nothing changed** still records the person at the scene, but says nothing new about them.
- **Deleting a scene takes back what it said.** A later scene that only repeated it now reads from before. Before, it kept the copy.
- **A first record's defaults are not stored.** "Alive" and "no travel mode" are what nothing said means.

## What is left

- **B3:** one resolver over people, items and places (`stateAt`), one write path (`state.say`), and a source rule against writing the old shape. Spreading a resolved state into `upsertSnapshot` is now harmless but still the shape the code is written in.
- **The ambiguity list from B1** (two people taking one item at once) is still not shown to the writer.
