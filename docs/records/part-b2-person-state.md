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

## What comes next in B2

- **Dexie v62.** Each world's records made sparse by `sparseRecords`, with the header's place repeats kept. The stored type becomes `PersonRecord`, so every reader of the raw table has to say how it reads one.
- **Readers.** `resolveCharacterSnapshot` and `selectBestCharacterSnapshots` become `personAt` and `peopleAt`. Screens that walk records read them through `wholeRecords`.
- **Writers say what changed.** Each writer says only the facets the act is about: Current State what the writer changed, the header's cast its place, a fate whether they live, the quick form its own fields. Nothing is copied from the state before, so the field half of the carry-forward offer has nothing left to carry.
- **`.pwk`.** An import of whole-state records makes them sparse, as the migration does.
- **The measure** stays this probe, re-run against the migrated store.
