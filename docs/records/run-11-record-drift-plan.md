# Run 11: records that drift from the header (W-2b, W-3, W-8's records)

Writer run 11 (`writer-run-2026-10-18-blind.md`) found that a correction at one
scene does not reach the scenes after it. The rest of that run's findings are
fixed. W-2a (pasted headers read bottom-up) is fixed by reading them in page
order. This plan covers what is left, which is a design question about the
snapshot model rather than a bug in one function.

## What goes wrong

A `CharacterSnapshot` stores a person's **whole** state at a scene: place,
alive, and the full inventory. Any write at a scene copies the rest of the
person's last state into the new record. That includes the header recording the
cast at the scene's place (`placeCastAtScene`), a hand-off elsewhere in the
scene (`outOfHands`), and a fate. Each copy is a fresh claim, at that scene,
about everything the person holds.

Once a later record exists, an earlier edit stops at it:

- **W-3, the item half.** S1 says `^Book:@Anna`. S2 has Anna and Bruno in its
  cast, so S2 records them both, and Anna's S2 record holds the Book, copied.
  Editing S1 to `^Book:@Bruno` moves the Book at S1. At S2 Anna's copy still
  has it, Bruno's copy does not, and the Book is back with Anna.
- **W-8's records.** `^Leaf:destroyed` takes the leaf out of its holder's
  hands at that scene. Records she already had at later scenes still list
  it: 14 checker rows in the run, now one (`f500b3e`), but the records are
  still wrong.
- **W-2, the place half.** S3's header puts Anna on the Quay. S1 already had
  her there, so no S3 record is written; "already there" is how the header
  avoids writing duplicate states (W5-4). If S2 is later given a header that
  puts Anna in the Vault, S3 resolves to the Vault. S3's own header still
  says Quay.

None of these show on the Page, which draws the header as it was typed. The
writer finds out from the checker, which then blames them for the drift.

## The rule a fix has to keep

`CLAUDE.md`: snapshots are written only by a direct user edit, and inheritance
is resolved at read time, so there is no bulk snapshot write. The operation
journal depends on that. So does the long list of bugs where a resolved
snapshot was written back to the wrong scene. Any option below that writes at
a scene other than the one being edited is an exception to this rule, and has
to be argued as one.

## Options

### A. Carry the edit forward over the copies it made stale (recommended for now)

When a header or panel edit changes who holds an item at scene S, from holder
*h* to holder *h'* (a person, a place, or nobody), walk the later scenes of S's
era in order. Before the edit, the item's holder at each scene was resolved from
the records. While that holder is still *h*, the later records are copies, and
each one is rewritten:

- *h*'s record there loses the item;
- *h'*'s record there, if *h'* is a person with a record there, gains it.

The walk stops at the first scene where the item's holder, as it stood before
the edit, is anyone other than *h*. That covers a later hand-off, a placement,
a condition such as `destroyed` or `lost`, and the item leaving *h*'s
inventory. That scene is the writer's next statement about the item, and
nothing at or after it is touched.

The stop rule needs no record of which inventories were copied. A scene where
the old holder still held the item is, by definition, one where nothing about
it was said. The rewrite is part of the same journal group as the edit, so one
Undo takes it all back.

For **places**: when the header records the cast at a place, it writes a record
for each person whether or not they already resolve there. The header said so,
and that is the writer's statement. This brings back some of the
duplicate-looking states W5-4 removed. The difference is that each one sits at
a scene whose own header asserts it. The checker's "duplicate state" rule would
need to accept a record at a scene whose header names the person and place.

*Cost:* a bounded write across later scenes, in one era, for one item, on one
edit. *Risk:* this is a new kind of write, and every past snapshot bug has been
a write landing on the wrong scene. It needs the same guard those got: a
source-level test that every forward write names its `eventId` from the walk.

### B. Hold items by the item, not by the person (the long-term model)

Record custody as per-item events: given to *p* at S, put at *L* at S, destroyed
at S. A person's inventory at a scene becomes a read-time answer ("every item
whose last custody event at or before here is *p*") instead of a stored list.
Nothing is copied, so nothing goes stale, and W-3 cannot happen.

*Cost:* a Dexie version with a migration that turns stored inventories into
custody events, plus every reader of `inventoryItemIds`. That covers the panel,
the checker, the map, the arc, `.pwk` import/export and merge. It is the right
model, and it is a project of its own.

### C. Leave the data, and make the drift visible and fixable

Add a checker rule: "*Anna* still carries *the Book* at S2, copied from before
S1 gave it to *Bruno*". Add a "Correct from here on" action that does A's
rewrite on request. The run's wishes list asked for exactly that action: one
"Lucia no longer has the leaf after Ch. 4" would have saved 14 edits.

*Cost:* small. *But* the records stay wrong until someone runs the check, and
the header on the page keeps saying something the records do not.

## Recommendation

**A now, B later.** A fixes the run's three cases at their cause, inside the
edit that caused them, with one Undo. It needs no migration and no change to
any reader. C's "from here on" action falls out of A's walk and can come later
if it is still wanted. B should be planned as its own piece of work. A's walk
is also the migration B would need, so A is not wasted.

## Tests A would need

- Integration (`fake-indexeddb`): the W-3 repro. After the edit, Bruno holds
  the Book at S1 and S2 and Anna holds it at neither. Paired: a later explicit
  hand-off to Carla at S4 is untouched, and so is everything after it.
- Integration: `:destroyed` at S, with the holder's records at S+1 and S+3. Both
  lose the item. A record at S+5 where the item was later given back
  (`repaired`) is untouched.
- Integration: another era's records are never touched (`stateEngine`'s era
  rule).
- Integration: one Undo restores every record the walk wrote.
- e2e: the W-3 steps on the Page, read from the records, then reload.
- The source rule: every forward write passes the walk's `eventId`.

## Built (option A)

Chosen by the user on 2026-10-19, and built as follows.

- **The walk** is `src/lib/staleCopies.ts`, and it runs at the end of
  `recordItemChanges`, inside its journal group. The Current State panel is
  unchanged. It already offers to carry a change forward on request (F2's
  toast, T-2's `itemCarryPlan`), with the same stop rule.
- **The holders are read from the records as they stood before the edit.** This
  was briefly simplified to the records after it, on the reasoning that the
  edit writes only at its own scene. That reasoning was wrong. Somebody given
  the item at S, with no later record, resolves to S's record at every later
  scene, so the walk stopped at the first one. The era test caught it once it
  stopped being vacuous; it had been stopping early at an unrelated hand-off.
- **Writes are updates by id** to records the walk found, setting
  `inventoryItemIds` and nothing else, so no `upsertSnapshot` spread is
  involved and `snapshotWriteScenes` has nothing to check.
- **Places:** `placeCastAtScene` records each living cast member at the
  header's place even when they already resolve there.

Tests: `src/db/hooks/__tests__/staleCopies.test.ts` covers the W-3 repro, the
stop at a later hand-off and what follows it, the stop at a placement, Undo,
another era, and W-8's destruction up to a repair.
`headerCastPlaced.test.ts` covers the place half. `e2e/recordDrift.spec.ts`
covers the W-3 steps on the Page, then a reload. Mutants killed:

- the walk not called, at unit and at e2e level;
- no stop at a statement;
- no stop at a change of holder;
- no era filter;
- holders read after the edit;
- the old "already there" skip.
