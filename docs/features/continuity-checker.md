# Feature: Continuity Checker

## Overview

The continuity checker scans the story for logical contradictions and flags them as errors or warnings. It runs live against IndexedDB data and lets the user navigate directly to the problem. The foundation is solid; the main gaps are additional check categories and quality-of-life (suppress false positives, batch navigation).

---

## What Already Works

- Modal dialog with error/warning counts in header
- **Character checks:**
  - Dead-then-alive: character marked alive in a snapshot after a death event (error)
  - Orphan snapshots: snapshots referencing deleted events (warning)
- **Item checks:**
  - Duplicate ownership: item in multiple characters' inventories or at multiple locations in the same event (error)
- **Relationship checks:**
  - Early snapshot: relationship snapshot exists before the relationship's `startEventId` (warning)
- **Travel distance checks:**
  - Computes pixel distance between consecutive location markers on the same map layer
  - Uses `TravelMode.speedPerDay` + `MapLayer.scalePixelsPerUnit` to compute days needed
  - Compares to `WorldEvent.travelDays`; flags impossible travel (warning)
- Click-to-navigate on each issue (sets `activeEventId`, navigates to chapter detail)
- Category grouping with icons and counts
- "No issues found" green state

---

## User Stories

- As a writer, I want to suppress a specific false-positive warning (e.g. a deliberate resurrection) so it stops showing up every time I run the checker.
- As a writer, I want to be warned when a character is shown at a location after that location was destroyed so I catch setting errors.
- As a writer, I want to be warned when a character uses an item they haven't acquired yet so I catch prop errors.
- As a writer, I want to be warned when a dead character is referenced in a relationship snapshot so I catch stale relationship data.
- As a writer, I want to navigate through all issues one by one with keyboard arrows instead of clicking each individually.

---

## Technical Approach

### Key files
- `src/features/continuity/ContinuityChecker.tsx` — full implementation (411 lines); all checks run in `useMemo`
- `src/types/` — `CharacterSnapshot`, `WorldEvent`, `LocationSnapshot`, `ItemPlacement`, `RelationshipSnapshot`

### Issue suppression
Add a `suppressedIssueIds: string[]` field to the Zustand store (persisted). Each `Issue` already has a stable `id` field (built from entity ids + check type). A "Suppress" button on each issue adds it to the set; a "Show suppressed" toggle reveals them greyed out.

```typescript
// Issue id pattern — already deterministic
id: `dead-then-alive-${snap.characterId}-${snap.eventId}`
```

### New check: location destroyed
Read `LocationSnapshot` records for each event. If a location has `status === 'destroyed'` or `status === 'ruined'` at event N, then any `CharacterSnapshot.currentLocationMarkerId` pointing to that location at event N+1 or later is a warning.

Requires knowing event order — use the `globalOrder` pattern already used elsewhere (`chapNum * 10_000 + sortOrder`).

### New check: item used before acquired
For each `CharacterSnapshot` with non-empty `inventoryItemIds`, find the earliest event where the character held the item. If an `involvedItemIds` reference on a *prior* event includes that item, flag a warning.

This requires joining `WorldEvent.involvedItemIds` with snapshot inventory history — an O(n²) scan across all events × snapshots, but acceptable for story-scale data.

### New check: dead character in relationship snapshot
If a `RelationshipSnapshot` exists at event N, and one of the relationship's characters has `isAlive: false` in their snapshot at event N, flag a warning.

### Keyboard navigation
Add `onKeyDown` to the modal container: ArrowDown/ArrowUp navigates between issues, Enter triggers the navigate action for the focused issue. Track `focusedIssueIndex` in local state.

---

## Open Questions

- Should suppressed issues be stored in Zustand (lost on clear) or in IndexedDB (permanent per-world)? Zustand is simpler; IndexedDB survives app reinstall.
- Should the "item used before acquired" check use `involvedItemIds` on events, or something more explicit like a "item first acquired at" event field? The current schema has no explicit acquisition field, so `involvedItemIds` is the best proxy.
- Should location destruction checks apply to sub-map locations or only top-level map layer locations?

---

## Tasks

- [x] **Issue suppression** — "Suppress" button per issue; store in Zustand (persisted); "Show suppressed" toggle
- [x] **Location destroyed check** — warn when character snapshot places a character at a destroyed/ruined location
- [x] **Item before acquired check** — warn when an event's `involvedItemIds` references an item before the character's first inventory snapshot containing it
- [x] **Dead character in relationship snapshot** — warn when a relationship snapshot references a character whose `isAlive` is false at that event
- [x] **Keyboard navigation** — ArrowUp/Down to move between issues; Enter to navigate; visible focus ring
