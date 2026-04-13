# Feature: Timeline Multi-Select

## Overview

Currently the timeline view supports single-event interaction only — you can open, delete, move, or set active one event at a time. Multi-select would allow bulk operations: delete several events at once, move a block of events to a different chapter, or tag a range of events together.

This is a meaningful productivity feature for writers who reorganise their stories during revision.

---

## What Already Works

- Chapter accordion with expand/collapse
- Per-event: move up/down, open detail, delete (with confirmation)
- Per-chapter: set active event, open detail, delete
- Events sorted by `sortOrder` within chapter; chapters sorted by `number` within timeline

---

## User Stories

- As a writer, I want to select multiple events with checkboxes so I can delete them all at once without repeating the confirmation.
- As a writer, I want to shift-click to select a range of events so I can quickly grab a block.
- As a writer, I want to move selected events to a different chapter so I can reorganise my story structure.
- As a writer, I want to bulk-assign a tag to selected events so I can categorise a subplot quickly.
- As a writer, I want a "select all events in this chapter" checkbox so I can act on an entire chapter's events without clicking each one.

---

## Technical Approach

### Key files
- `src/features/timeline/TimelineView.tsx` — timeline shell (133 lines)
- `src/features/timeline/ChapterRow.tsx` — chapter accordion (137 lines)
- `src/features/timeline/EventRow.tsx` — single event row (148 lines)
- `src/store/index.ts` — Zustand store (add `selectedEventIds`)
- `src/db/hooks/useTimeline.ts` — add bulk DB operations

### Store changes
Add `selectedEventIds: Set<string>` to the Zustand store (not persisted — selection is session-only). Expose `toggleEventSelected(id)`, `selectEventRange(ids)`, `clearSelection()`, and `selectedEventIds`.

```typescript
selectedEventIds: new Set<string>(),
toggleEventSelected: (id) => set((s) => {
  const next = new Set(s.selectedEventIds)
  next.has(id) ? next.delete(id) : next.add(id)
  return { selectedEventIds: next }
}),
selectEventRange: (ids) => set((s) => ({
  selectedEventIds: new Set([...s.selectedEventIds, ...ids])
})),
clearSelection: () => set({ selectedEventIds: new Set() }),
```

### EventRow changes
- Add a checkbox on the left (visible on hover or always when any event is selected)
- Checkbox `checked` reads from `selectedEventIds.has(event.id)`
- Shift-click: collect all event ids between last-clicked and current in the same chapter's `sortedEvents` array; call `selectEventRange`
- Track `lastClickedEventId` in local state within `ChapterRow` (or `TimelineView`)

### ChapterRow changes
- Add a "select all" checkbox in the chapter header (indeterminate state when partial)
- Clicking it toggles all events in the chapter

### Bulk action toolbar
When `selectedEventIds.size > 0`, show a sticky toolbar at the bottom of the timeline:
```
[X events selected]  [Delete]  [Move to chapter ▾]  [Add tag ▾]  [Clear]
```
- **Delete**: confirm dialog showing count; calls `deleteEvent` in a loop + `clearSelection`
- **Move to chapter**: dropdown of other chapters; reassigns `chapterId` + recalculates `sortOrder` (appends to end of target chapter); updates all snapshot `eventId` references via a Dexie transaction
- **Add tag**: text input; appends tag to each selected event's `tags` array

### Bulk DB operations to add in `useTimeline.ts`
```typescript
export async function bulkDeleteEvents(ids: string[]): Promise<void>
export async function bulkMoveEvents(ids: string[], targetChapterId: string): Promise<void>
export async function bulkAddTag(ids: string[], tag: string): Promise<void>
```

`bulkMoveEvents` is the most complex — it must reassign `chapterId`, recalculate `sortOrder` (append to end), and NOT move snapshots (snapshots are keyed by `eventId` which doesn't change).

### Drag-to-reorder chapters
Separate from multi-select but related. Use `@dnd-kit/sortable` on the chapter list in `TimelineView`. On drop, compute new `number` values and call `updateChapter` for affected chapters. This is independent of the multi-select work and can ship separately.

---

## Open Questions

- Should `selectedEventIds` be in Zustand or local component state? Zustand makes the selection accessible to the bulk toolbar regardless of accordion collapse state. Local state is simpler but selection clears when chapter collapses.
- Should moving events to another chapter also move their snapshots? No — snapshots are keyed by `eventId`, so they follow the event automatically. Only `chapterId` on the event itself changes.
- Should bulk delete require per-event confirmations or one combined confirmation? One combined confirmation ("Delete 4 events and all their snapshots?") is the right UX.

---

## Tasks

- [ ] **Store: `selectedEventIds`** — add Set + toggle/range/clear actions to Zustand store (not persisted)
- [ ] **EventRow checkboxes** — show checkbox on hover; wire to store; support shift-click range selection
- [ ] **ChapterRow select-all** — header checkbox with indeterminate state; toggles all child events
- [ ] **Bulk action toolbar** — sticky bar at bottom of timeline; shows when selection non-empty; Delete / Move / Tag / Clear
- [ ] **`bulkDeleteEvents`** — DB helper; delete events + cascade snapshots in a transaction; confirm dialog with count
- [ ] **`bulkMoveEvents`** — DB helper; reassign `chapterId` + recalculate `sortOrder` for moved events
- [ ] **`bulkAddTag`** — DB helper; append tag to `tags[]` on each event
- [ ] **Drag-to-reorder chapters** — `@dnd-kit/sortable` on chapter list; renumbers chapters on drop (separate PR)
