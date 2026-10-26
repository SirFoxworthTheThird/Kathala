# Part B1: item custody as statements — the model and its probe

**Plan:** `next-plan.md`, Part B1, and decision D-1.
**Code:**
- `src/lib/custody.ts` (the model);
- `scripts/custody-probe.ts` (`npm run probe:custody`);
- `src/lib/__tests__/custody.test.ts`.

**Status:** the model and the probe, run over the Library. No table, migration or reader changed yet.

## The model

**A custody statement** says one thing about one item at one scene.
- **For a unique item:** who has it, where it was put, or both: carried, at the place a placement put it. Neither means in nobody's hands, and nowhere said.
- **For a collective item** (`Item.isCollective`: lembas, a cloak the whole Fellowship wears): each person's share is a statement of its own. They have some from here, or they have none.

**Reading it at a scene:**
- **A unique item:** the last statement at or before the scene, in the scene's era.
- **With none in this era:** the last *placement* from an earlier era in in-world time, said as carried from there. A holder from another era is not carried; the person is not here to hold it.
- **A collective item:** each person by their own last statement, in the scene's era.

One statement per unique item at a time, so it cannot be in two pairs of hands, and nothing is copied forward.

## Deriving the statements from the records there are

This is what the migration will do. Walking the book in order, a statement is written only where something changed:

1. **A placement:** it lies there.
2. **An item entering a person's inventory** (listed in their record, and not in their record before it, in their era): they have it.
3. **An item leaving its holder's inventory:** nobody has it. It stays where it was last put, if a placement said so; otherwise nowhere is said.
   - A person who stops listing something somebody else has since been given says nothing about it.
4. **A record that goes on listing what the one before it listed is a copy, and says nothing.** That is the difference from today, where the copy is read as the fact.
5. **At one scene, a placement wins over an inventory,** as today, except where it puts the item where a person whose record there lists it is.
   - Then it says where *they* have it, not that it was put down.
   - Of several carriers there, the one who took it in at that scene is preferred, then whoever already had it.
6. **Two people taking a unique item at the same scene is an ambiguity.** The first by id is kept, and the ambiguity is returned for a person to check.

Each rule is tested in `custody.test.ts`. Each was also mutated (removed or inverted, gated on `tsc -b && eslint` and the mutation landing), and each mutant fails at least one test: 4 of 4.

## The probe

**What it covers:**
- every book in the Library (`Kathala-Library` at `773f43c`);
- the three writer-run worlds committed in `docs/records`;
- the app's own `.pwk` fixtures.

That is 67 worlds, each loaded through the app's own import, as a user's would be. The plan names eleven writer-run worlds; only three were ever committed, so three are probed.

**Today's reading, which the statements are compared against:**
- **Where an item is** (the Items roster, the map, the checker): the last placement wins, then any holder.
- **What a person holds** (Current State, the header, the cast): their last record's inventory, whatever else says.

**Final run** (`custody-probe.txt`; per-world numbers and samples there):

| | |
|---|---|
| Items | 753 (25 collective) |
| Records listing an item; item mentions in them | 1,669; 3,203 |
| Placements | 1,830 |
| **Statements derived** | **1,890** |
| Two people taking one unique item at one scene | 12 |

### Where an item is: 72,295 item × scene readings

| Cause | Readings | Items | Worlds | What it is |
|---|---|---|---|---|
| `carrierNamed` | 2,676 | 125 | 15 | Same place; the statements also say who has it there. Not a change of where it is. |
| `pickedUp` | 299 | 17 | 7 | Today it lies where it was put down for the rest of the book, though someone's inventory took it in later. The statements give it to them. |
| `releasedAfterPickUp` | 553 | 9 | 4 | The consequence of `pickedUp`: picked up, then its holder stopped listing it. Nowhere is said, where today the old placement still reads. |
| `twoHandsKept` | 58 | 3 | 3 | Today in two or more pairs of hands; the statements keep one. |
| `copyOutvoted` | 0 | | | |
| `other` | 0 | | | Anything unexplained. |
| `sharedDiffers` | 0 | | | A collective item's holders differing at all. |

### What a person holds: 147,742 person × scene readings

| Cause | Readings | Items | Worlds | What it is |
|---|---|---|---|---|
| `copyDroppedOther` | 338 | 32 | 7 | A copy says they hold it; the statements follow a hand-off since. |
| `copyDroppedPlaced` | 247 | 19 | 6 | A copy says they hold it; a placement since put it elsewhere. |
| `copyDroppedNowhere` | 132 | 4 | 1 | A copy says they hold it; its holder since let it go. |
| `gained` | 0 | | | Somebody given something their record does not list. |

**Every person-level change is a record that copied the one before it** and was outvoted by a later statement. Every change in where an item is is one of the four causes above. Nothing changed for an unexplained reason.

## How the rules got here, measured

Each rule came from a run of the probe that showed it was wrong without it.

1. **The first walk reproduced today's reading exactly:** a statement wherever the statements so far read differently.
   - It agreed everywhere, except 417 readings with two holders.
   - But it carried over today's wrong answers. 1,173 person × scene readings had the item picked up after it was put down, and today the placement wins over every later inventory.
2. **Change-based** (rules 1–4): 299 `pickedUp`, now intended.
   - But a person lost an item in 4,705 person × scene readings: 3,113 to a placement, 1,460 to another holder, 132 to nobody.
3. **Collective items as each person's share:** lembas and the elven cloaks had been "taken" from all but one hobbit.
   - Twenty-five items in the Library are collective.
   - Losses to another holder fell from 1,460 to 175. `sharedDiffers` and `gained` are 0.
4. **A placement at a carrier's place is theirs** (rule 5):
   - In *A Princess of Mars*, all 53 of 53 placements are at a scene where a record lists the item, at the carrier's place: the book records every carried thing as placed where its carrier is.
   - Person-level changes fell from 3,393 to 717.
   - But "where" now said *nowhere* in 5,921 readings: the revolvers once John Carter let go of them. Today they read as left in the Arizona cave, where the novel leaves them when he wakes on Mars without them.
5. **Let go, it stays where it was put** (rule 3's second half): those 5,921 became 553, all after a real pick-up.
6. **The taker preferred at a shared placement:** before it, Ino kept her veil at the scene she gave it to Odysseus (by name order). Person-level `copyDroppedPlaced` went from 410 to 247.

## Checked by hand

| Book | Item, scene | Today | Statements | Against the record and the novel |
|---|---|---|---|---|
| *Fellowship* | The One Ring, "Master of Bag End" | Bilbo **and** Frodo | Frodo | Bilbo's records list it to "Confrontation at Bag End", Frodo's from "Master of Bag End". Right. |
| *Fellowship* | Mithril Coat, "Orcs Find Frodo" | Frodo and Shagrat | Shagrat | The orcs take it. Right. |
| *Jane Eyre* | Jane's Portfolio, "Jane's Drawings Are Examined" | at the Schoolroom and Library | held by Jane | Rochester examines what she brings. Right. |
| *Journey to the West* | Brocade Cassock, "A Cover, and a Wind" | Tripitaka lists it | at the Guanyin Monastery | Placed there after he had it: the theft. Tripitaka's later records copy it. Right. |
| *A Princess of Mars* | Carter's Revolvers, after "Refuge in the Cave" | at the Arizona Cave | at the Arizona Cave, carried by John until he lets go | The same; the statements also name who had it. |
| *The Odyssey* | Ino's Veil, "Poseidon's Storm" | Ino, Odysseus and Poseidon all list it, all at Scheria, at one scene | Ino | **The record disagrees with itself.** One of the 12 ambiguities; the migration lists them for a person, it does not decide. |

## What was built

B1 went in as four commits, each green on its own.

1. **The table.** `itemCustody` (Dexie v61), keyed by `custodyId`, with its rows derived per world by `deriveWorldCustody` in the upgrade. It is on the journal as the `itemCustody` entity, cascades with scenes, chapters, timelines, items, people and worlds, is checked by the health panel, and travels in `.pwk`/`.pwb`: export writes it, an import without it derives it (`ensureCustody`), and merge unions it by id. Ids are derived from item and scene, so two derivations of one file are the same rows, not twice as many.
2. **Writes.** Every act that moves an item says one statement through `src/db/hooks/useCustody.ts`: the header's Items line, Current State (`sayInventory` writes only what the writer added or took out), the map's character panel, placing, taking back, destroyed and lost, and carrying an item forward (`keepHolding`). The chapter AI import, which writes whole-state records, rederives its scenes (`rederiveCustodyAt`). A world that reaches the store with records and no custody is derived once (`useCustodyBackfill`).
3. **Reads.** States resolved at the cursor carry custody's inventory (`withHoldings`): Current State, a person's card, the brief, the map. Screens that walk records get each record's inventory as custody has it at that record's scene (`useRecordsWithCustody`): history, the checker, the arc grid, the chapter diff, the cast on a chapter. The Items roster and the map sidebar read `holdingsAt`; the item page's Whereabouts steps come from the statements; the header draws hand-offs and placements from them.
4. **The old writes go.** `staleCopies`, `carryOverStaleCopies`, `outOfHands` and `giveBackToLastHolder` are deleted, and no act writes a holder's state record to move an item. `inventoryItemIds` is still stored on each record, and nothing reads it as who holds what.

### Decisions made on the way

- **A destroyed item leaves its holder's hands wherever they are.** Before, a holder elsewhere kept it (W5-7), because taking it meant writing them a state at a scene they are not in. A statement writes no state, so that reason is gone.
- **The carry-forward offer for items stays.** The migration derives a release wherever a record stopped listing an item, so books recorded the old way still have items vanishing the scene after they were given. The offer now reads custody's inventories and keeps the item in hand (`keepHolding`), and in a book written since, it only appears where a release was really said.
- **Taken back from two holders, nobody is guessed at.** The old header test "gives nothing back where two people had it" is gone: custody has one holder per unique item, so taking a placement off reads as before, without a choice to make.

### Verified

- **Unit tests.** `custody.test.ts` covers the rules, `itemCustody.test.ts` the migration, import, merge and cascades, and `custodyWrites.test.ts` the write intents. The header, condition, era and placement tests and `custodyCorrections.test.ts` (formerly `staleCopies.test.ts`, same W-3 and W-8 scenarios) now assert custody. `itemWhereabouts.test.ts` covers the roster's reading of holdings.
- **E2E.** `e2e/custody.spec.ts` runs W-3 by the Current State route: Rell holds past Ovin's later copy, Ovin does not (and does at chapter one), and both the item page and the roster show it.
- **Mutants**, each gated on `tsc -b && eslint && grep`:
  - the four derivation rules;
  - reading across eras;
  - destroyed not releasing;
  - the roster's collective names;
  - item page custody off;
  - the panel reading off;
  - roster holdings off;
  - the take-back mutant, which found a real bug: it removed somebody else's hand-off.

  All were killed.

### Not covered, and why

- The map sidebar's item list goes through `resolveItemWhereabouts`, the same function the roster spec and the unit tests cover; it has no spec of its own.
- The header's custody parameter draws what it drew before on derived data. The header tests assert the hand-off and placement it draws, but there is no spec that would fail if the header read the records again.

## What is left of B1

- **The 12 ambiguities** (two people taking one item at one scene) are resolved by keeping the first taker by id, as the probe reports. The plan asked for them to be listed for the writer once; that list is not built.
- **`inventoryItemIds` is still written** by every state save, as a copy. Dropping the field is B2's work, when a person's state becomes per-field statements.

B2 and B3 follow in their own changes.
