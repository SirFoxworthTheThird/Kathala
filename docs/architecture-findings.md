# Architecture Findings — Items to Fix

> Generated: 2026-04-26  
> Scope: Full codebase review against local-first, snapshot-model architecture.

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

---

### 4. Stale `activeEventId` on cold load

**File**: [src/store/index.ts](../src/store/index.ts) (line 209)

`activeEventId` is persisted to localStorage. If the referenced event is deleted while the app is closed (e.g., world data replaced via folder sync or import), the app boots with a dangling cursor pointing to a non-existent event.

The store resets `activeEventId` to `null` on `setActiveWorldId`, but there is no guard on the initial hydration path.

**Impact**: Hooks that read "current event" receive a stale ID; queries return empty or incorrect results until the user manually changes the event selection.

**Fix**: After world selection resolves, validate that the persisted `activeEventId` exists in the `events` table. If not found, set it to `null` (or to the first event in the active world).

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

---

### 6. No enforced cross-feature import boundaries

**Directory**: [src/features/](../src/features/)

Feature folders have no barrel `index.ts` exports and no lint rule preventing direct deep imports between features. With 15+ feature folders this will degrade into implicit coupling over time.

**Fix**: Add an ESLint rule (`boundaries/element-types` or `no-restricted-imports`) that requires cross-feature imports to go through a public surface. As a first step, add `index.ts` barrel files to each feature folder and ban `../../otherFeature/InternalComponent` patterns.

---

## LOW

### 7. No note about preserving old version blocks in database.ts

**File**: [src/db/database.ts](../src/db/database.ts)

Dexie requires all prior `version()` blocks to remain in the constructor indefinitely so existing databases can upgrade through the full migration chain. There is no comment or CLAUDE.md note documenting this, which means a future cleanup pass could accidentally break upgrades for any database below the removed version.

**Fix**: Add a comment at the top of the `PlotWeaveDB` constructor and a line to [CLAUDE.md](../CLAUDE.md) under the Data Layer section:
> Never remove old `.version(N)` blocks from `PlotWeaveDB`. Dexie requires the full migration chain to be present to upgrade databases from any prior version.