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

## What comes next in B1

- **Dexie v61:**
  - a `custody` table;
  - its rows derived by `deriveCustody` from each world's records;
  - `CharacterSnapshot.inventoryItemIds` and `ItemPlacement` left in place, as records that are no longer read for custody.
  - The 12 ambiguities, and any a user's own world has, are kept as a list the app shows once.
- **Writes:** a hand-off, a placement, a release or a header's Items line writes one statement, journalled. `staleCopies` and the item half of `carryForward` go, since there is nothing left to drift.
- **Readers:** everything that asks who holds what or where an item is reads `custodyAt` / `inventoryAt` / `sharedHoldersAt`. `inventoryItemIds` appears 98 times in 32 files; the probe's two readings are the two questions they ask.
- **`.pwk`:** import of a file without statements derives them as the migration does; export writes them. Merge unions them by id, as other records.
- **The measure** stays this probe, re-run against the migrated store. It should give the same counts at every scene as `deriveCustody` does here. Plus the run-11 W-3 and W-8 repros through the Current State panel as well as the header.
