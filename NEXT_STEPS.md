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

## Remaining Work

### 1. IndexedDB Live-Data Migration (High Priority)

Users running the app against existing IndexedDB data (created before the refactor) need an **in-app schema migration**, not just an import migration.

- Add a new `.version(N)` block in `src/db/database.ts`
- For each world's snapshots/movements: read records with `chapterId`, find the first event of that chapter, write a new record with `eventId`, delete the old one
- For relationships: rename `startChapterId` → `startEventId`
- This is separate from the `importWorld` v1→v2 migration (which handles exported `.pwk` files)

### 2. Travel Distance Continuity Check

`ContinuityChecker.tsx` was updated to use correct event/chapter lookups, but the **actual travel distance validation** is not yet implemented.

- `WorldEvent.travelDays` encodes the days of travel before each event
- Use `TravelMode.speedPerDay` and map layer `scalePixelsPerUnit`/`scaleUnit`
- Check: if a character moves between two locations across consecutive events, is the distance feasible given the travel days on the event?
- Flag as a warning if the character would need more days than are available

### 3. ChapterDetailView — Event Reordering UX

`src/features/timeline/ChapterDetailView.tsx` renders events within a chapter. Review and verify:
- Drag-to-reorder events updates `sortOrder` correctly
- Creating a new event correctly inherits snapshots from the previous event in the same chapter (not from the chapter's position — that inheritance logic is in `createEvent`)
- Deleting an event cascades snapshots correctly

### 4. Relationship Graph — `startEventId` UI

`src/features/relationships/RelationshipGraphView.tsx` has a `SnapshotEditor` that lets users set when a relationship started. Verify:
- The "started in" picker shows events (not chapters)
- Saving writes `startEventId` (not `startChapterId`)
- The graph edge visibility correctly uses global event order

### 5. CharacterArcView — Event-Level Granularity (Optional)

Currently the arc table shows one column per **chapter**, displaying the last event's snapshot. Consider:
- Optionally expanding a chapter column to show individual event columns
- Or adding a toggle: "chapter view" vs "event view"

This is a product decision — the current per-chapter view is usable as-is.

### 6. WritersBriefPanel — Active Event Header

`WritersBriefPanel.tsx` shows the chapter header (number + title + synopsis). Since the active cursor is now an event, consider also showing the active event's title so the brief reflects where in the chapter the writer is.

### 7. Deprecated Alias Cleanup (Low Priority)

Once all call-sites are confirmed working, remove the deprecated bridge in `src/store/index.ts`:

```typescript
// These can be removed once no component uses them:
export const useActiveChapterId = () => useAppStore((s) => s.activeEventId)
export const setActiveChapterId = ...
```

Search for `useActiveChapterId` / `setActiveChapterId` in the codebase before removing.

### 8. E2E Tests

`npm run electron:dev` — manually verify the full user flow:
- Create world → create timeline → create chapter → create event
- Set character snapshot at event
- Navigate between events with the timeline bar
- Export world → import world (round-trip check)
- Import an old v1 `.pwk` file (v1→v2 migration check)
