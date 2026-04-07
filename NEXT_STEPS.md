# Next Steps — Option A Post-Refactor

This document tracks remaining work after the Option A architectural refactor (events as primary time unit, chapters as grouping folders).

## Status

The core refactor is complete and stable:
- `activeEventId` is the global time cursor (replaces `activeChapterId`)
- All snapshots/movements are keyed by `eventId`
- All UI components derive the active chapter from the active event
- Export/import supports v1→v2 migration for old files
- 307 tests passing, build clean

---

## Completed

- **#1 IndexedDB Live-Data Migration** — implemented as `database.ts` v10; migrates all snapshot tables and relationships from `chapterId` to `eventId`
- **#2 Travel Distance Continuity Check** — implemented in `ContinuityChecker.tsx`
- **#4 Relationship Graph `startEventId` UI** — added "Started in" event picker to graph side panel; edge visibility already used correct `globalOrder`
- **#5 CharacterArcView Event-Level Granularity** — added Chapters/Events toggle; event view shows one column per event
- **#6 WritersBriefPanel Active Event Header** — chapter card now shows active event title/description; Events list highlights the active event
- **#7 Deprecated Alias Cleanup** — removed `useActiveChapterId` / `useSetActiveChapterId` from store; updated `CharacterCard.tsx`
- **#RelationshipsTab bugs** — fixed event/chapter lookup using `eventById` map and proper `globalOrder`

---

## Remaining Work

### 1. IndexedDB Live-Data Migration ✓ DONE

Implemented as `database.ts` `.version(10)`. Handles:
- Creates synthetic events for chapters with no events (so snapshot records have a valid `eventId`)
- Re-keys all snapshot/movement/placement tables: `chapterId → eventId`
- Migrates `Relationship.startChapterId → startEventId`
- Transfers `travelDays` from chapters to first events; strips it from chapters

### 2. Travel Distance Continuity Check ✓ DONE

Implemented in `ContinuityChecker.tsx`. Flags warning when character's consecutive location change requires more travel days than the event's `travelDays`, given `TravelMode.speedPerDay` and map layer scale.

### 3. ChapterDetailView — Event Reordering UX ✓ VERIFIED

All three points confirmed correct:
- `moveEvent` swaps `sortOrder` between adjacent events
- `createEvent` inherits from previous sibling in same chapter, falls back to last event of previous chapter
- `deleteEvent` cascades all snapshot/placement/movement/relationship-snapshot tables

### 4. Relationship Graph — `startEventId` UI ✓ DONE

Added "Started in" event picker to the graph side panel. Saves `startEventId` via `updateRelationship`. Edge visibility already used correct `globalOrder`.

### 5. CharacterArcView — Event-Level Granularity ✓ DONE

Added a Chapters/Events toggle in the header. Event view shows one column per event sorted by chapter order then `sortOrder`; clicking sets the exact event as the active cursor.

### 6. WritersBriefPanel — Active Event Header ✓ DONE

The chapter header card now shows an "Active Event" sub-section with the event title and description. The Events list also highlights the active event with an accent background.

### 7. Deprecated Alias Cleanup ✓ DONE

Removed `useActiveChapterId` / `useSetActiveChapterId` from `src/store/index.ts`. Updated `CharacterCard.tsx` (only consumer).

### 8. E2E Tests

`npm run electron:dev` — manually verify the full user flow:
- Create world → create timeline → create chapter → create event
- Set character snapshot at event
- Navigate between events with the timeline bar
- Export world → import world (round-trip check)
- Import an old v1 `.pwk` file (v1→v2 migration check)
