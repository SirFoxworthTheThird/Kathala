# Architecture Findings — 2026-04-26 review (all closed)

> Generated: 2026-04-26  
> Scope: Full codebase review against local-first, snapshot-model architecture.  
> **Status: closed. All seven items are fixed** — verified against the code on
> 2026-08-23, item by item, with each fix named below.

This is kept as a record rather than a backlog. The severity headings below are
the ones the review assigned at the time; nothing here is outstanding, and the
CRITICAL section in particular describes a data-corruption risk that has been
gone since v31. The reasoning is worth keeping — the sortKey analysis in item 2
is why the formula is what it is — so the findings are left as written and each
one carries a **Closed** note.

The live tracker is [ux-review.md](./ux-review.md).

---

## CRITICAL

### 1. sortKey index missing on three snapshot tables

**File**: [src/db/database.ts](../src/db/database.ts)  
**Migration introduced**: v13 (line 272)

v13 adds `[worldId+entityId+sortKey]` compound indexes to four tables but omits three that participate in the same delta-query model:

| Table | Has sortKey index |
|---|---|
| `characterSnapshots` | ✅ |
| `locationSnapshots` | ✅ |
| `itemSnapshots` | ✅ |
| `relationshipSnapshots` | ✅ |
| `itemPlacements` | ❌ missing |
| `characterMovements` | ❌ missing |
| `mapRegionSnapshots` (v15) | ❌ missing |

**Impact**: "Last known state before event N" queries on placements, movements, and region snapshots fall back to a full in-memory scan + sort instead of an indexed range scan. Performance degrades linearly with world size.

**Fix**: Add a new migration version that extends those three tables with `[worldId+itemId+sortKey]`, `[worldId+characterId+sortKey]`, and `[worldId+regionId+sortKey]` indexes, and backfills `sortKey` values using the same formula as v13.

**Closed** — `.version(30)` in `src/db/database.ts` adds all three compound
indexes exactly as proposed and backfills `sortKey` in its `upgrade`, using the
v13 formula so that v31 (item 2) could then recompute every table uniformly.

---

### 2. sortKey formula can overflow

**File**: [src/db/database.ts](../src/db/database.ts)  
**Migration introduced**: v13 (line 287)

```ts
sortKey = chapter.number × 10_000 + event.sortOrder
```

`event.sortOrder` is unbounded. If any event in chapter N has `sortOrder ≥ 10_000`, its sortKey overlaps with chapter N+1, breaking chronological ordering for all delta queries.

**Impact**: Silent data corruption — queries return the wrong snapshot as "last known state." No error is thrown.

**Fix (option A — preferred)**: Switch to a fractional scheme:
```ts
sortKey = chapter.number + event.sortOrder / 1_000_000
```
Requires a migration to recompute all existing sortKey values.

**Fix (option B — low-cost)**: Enforce `sortOrder < 10_000` as a hard invariant in the event CRUD functions and add a DB health check assertion.

**Closed — option A.** `.version(31)` recomputes every stored `sortKey` to
`chapter.number + event.sortOrder / 1_000_000`, and `src/lib/sortKey.ts` is the
single place that formula now lives (`computeSortKey`,
`computeSortKeySync`, `recomputeSnapshotSortKeysForEvent`).

The old form outlived the fix in the documentation, though, and this pass is what
caught it: `CLAUDE.md` and a comment in `CurrentStateTab` both still described the
key a snapshot *carries* as `chapter.number × 10_000 + sortOrder`, months after
v31 stopped writing it. Anyone computing a key from either would have produced one
on the wrong scale — the exact failure `snapshotSortKeyScale.test.ts` exists for,
where `1.001 > 1.000001` rules a snapshot out at its own event. Both are corrected,
and `sortKeyFormulaDocs.test.ts` now holds the claim.

The multiplied form legitimately survives in two places, and neither is a stored
key: inside the v30 upgrade block, which must write what v31 expects to read, and
as an in-memory comparator in views that sort a list they already hold
(`TimeCursor`, `ChapterTimelineBar`, `computeIssues`, `RelationshipGraphView`),
where it only has to be monotonic.

---

## HIGH

### 3. Suppressed continuity issues not exported with world data

**Files**:  
- [src/store/index.ts](../src/store/index.ts) (lines 76–79, 174–192, 207–210)  
- [src/features/continuity/ContinuityChecker.tsx](../src/features/continuity/ContinuityChecker.tsx)

`suppressedIssueIds` and `suppressedNotes` are stored in the Zustand persist slice (localStorage key `plotweave-ui`), not in IndexedDB. They are keyed by `worldId` inside a single flat object.

**Impact**:
- When a world is exported and re-imported (or opened on another device), all suppression decisions are silently lost.
- The data does not round-trip through the standard world export blob.

**Fix**: Create a `continuitySuppressions` table in the DB (new migration version):
```
continuitySuppressions: 'id, worldId, issueId'
```
Move read/write through a `useContinuitySuppressions(worldId)` hook. Remove `suppressedIssueIds` and `suppressedNotes` from the Zustand store and its `partialize` config.

**Closed** — built as proposed, with one addition. `.version(32)` creates
`continuitySuppressions: 'id, worldId, issueId, [worldId+issueId]'`; the compound
index was not in the proposal and is what makes the per-world lookup indexed.
`src/db/hooks/useContinuitySuppressions.ts` owns read and write, and neither
`suppressedIssueIds` nor `suppressedNotes` remains anywhere in
`src/store/index.ts`. The suppressions travel in the export blob
(`exportImport.ts`), and the deprecated `suppressedIssueIds` array is still
*read* on import and merged with the table, so a world exported before v32 does
not lose its decisions on the way in.

---

### 4. Stale `activeEventId` on cold load

**File**: [src/store/index.ts](../src/store/index.ts) (line 209)

`activeEventId` is persisted to localStorage. If the referenced event is deleted while the app is closed (e.g., world data replaced via folder sync or import), the app boots with a dangling cursor pointing to a non-existent event.

The store resets `activeEventId` to `null` on `setActiveWorldId`, but there is no guard on the initial hydration path.

**Impact**: Hooks that read "current event" receive a stale ID; queries return empty or incorrect results until the user manually changes the event selection.

**Fix**: After world selection resolves, validate that the persisted `activeEventId` exists in the `events` table. If not found, set it to `null` (or to the first event in the active world).

**Closed** — `src/components/AppShell.tsx` validates the persisted cursor
against the `events` table on mount and on every world change, clearing it when
the event is gone. It deliberately does *not* re-run on every `activeEventId`
change, which would be a database read per cursor step.

---

## MEDIUM

### 5. Pending focus IDs not reset on world switch

**File**: [src/store/index.ts](../src/store/index.ts) (line 100)

`setActiveWorldId` resets `activeEventId`, `activeMapLayerId`, and `mapLayerHistory` but does not clear `pendingFocusRouteId`, `pendingFocusRegionId`, or `pendingFocusMarkerId`. A pending focus set while on world A could fire when the user switches to world B and navigates to Maps.

**Fix**: Add the three pending focus fields to the reset in `setActiveWorldId`:
```ts
setActiveWorldId: (id) => set({
  activeWorldId: id,
  activeEventId: null,
  activeMapLayerId: null,
  mapLayerHistory: [],
  pendingFocusRouteId: null,
  pendingFocusRegionId: null,
  pendingFocusMarkerId: null,
})
```

**Closed** — all three pending-focus fields are cleared in `setActiveWorldId`.
One line of the proposed fix was *not* taken and should not be: `activeEventId`
is no longer reset to `null` on a world switch. Null is not a neutral starting
point in this app — it means "all chapters", i.e. full reveal — so switching
worlds now restores each world's remembered cursor from `eventByWorld`. Resetting
it was a spoiler leak, not a tidy-up.

---

### 6. No enforced cross-feature import boundaries

**Directory**: [src/features/](../src/features/)

Feature folders have no barrel `index.ts` exports and no lint rule preventing direct deep imports between features. With 15+ feature folders this will degrade into implicit coupling over time.

**Fix**: Add an ESLint rule (`boundaries/element-types` or `no-restricted-imports`) that requires cross-feature imports to go through a public surface. As a first step, add `index.ts` barrel files to each feature folder and ban `../../otherFeature/InternalComponent` patterns.

**Closed** — `eslint.config.js` scopes a `no-restricted-imports` rule to
`src/features/**`, banning the `@/features/*/**` group with the message *"import
from the barrel (`@/features/<name>`) not internal files"*. 19 of the 22 feature
folders have a barrel; the three without are simply not imported across. There
are currently zero deep cross-feature imports.

The rule was checked rather than assumed: adding
`import { SearchPalette } from '@/features/search/SearchPalette'` to
`features/arc/CharacterArcView.tsx` fails lint with that message. A boundary rule
that matches nothing looks identical to one that works.

---

## LOW

### 7. No note about preserving old version blocks in database.ts

**File**: [src/db/database.ts](../src/db/database.ts)

Dexie requires all prior `version()` blocks to remain in the constructor indefinitely so existing databases can upgrade through the full migration chain. There is no comment or CLAUDE.md note documenting this, which means a future cleanup pass could accidentally break upgrades for any database below the removed version.

**Fix**: Add a comment at the top of the `PlotWeaveDB` constructor and a line to [CLAUDE.md](../CLAUDE.md) under the Data Layer section:
> Never remove old `.version(N)` blocks from `PlotWeaveDB`. Dexie requires the full migration chain to be present to upgrade databases from any prior version.

**Closed** — both. The comment sits in the `PlotWeaveDB` constructor above the
version chain, and `CLAUDE.md` carries the line in its Data layer section. The
chain now runs to `.version(54)`, so the note guards considerably more than it
did when this was filed.