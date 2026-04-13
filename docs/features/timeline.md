# Feature: Timeline

## Overview

The Timeline feature organises a story into timelines, chapters, and events. It is the structural backbone of the app — every snapshot record is keyed to an event, and the `sortKey = chapter.number * 10_000 + event.sortOrder` defines global ordering across all views.

---

## What Already Works

- **Timelines** — a world can have multiple named timelines; each contains an ordered list of chapters
- **Chapters** — ordered by `chapter.number`; each has a title, optional synopsis, and can belong to one timeline
- **Events** — ordered by `sortOrder` within a chapter; each has a title, synopsis, involved characters, travel days estimate
- **Chapter detail view** (`ChapterDetailView`) — expandable event list; each event shows all character snapshots for that event grouped by character; characters with no snapshot in the chapter listed at the bottom
- **Writer's Notes** — freeform notes column per chapter, auto-saved on change
- **Snapshot cards** (`SnapshotCard`) — shows character location, inventory items with images, alive/dead status, and status notes per event
- **Chapter AI dialog** (`ChapterAIDialog`) — paste AI-generated chapter text, preview parsed events and character snapshots, import with one click
- **Event navigation from search** — selecting an event in `SearchPalette` calls `setActiveEventId` before navigating
- **Snapshot inheritance on chapter create** — new chapter inherits all snapshots from the last event of the preceding chapter
- **Add / reorder / delete** — `AddChapterDialog`, `AddEventDialog`, drag-to-reorder chapters and events

---

## User Stories

- As a writer, I want to drag chapters between timelines so I can restructure parallel storylines without recreating them.
- As a writer, I want to bulk-select and delete chapters so I can remove a discarded subplot quickly.
- As a writer, I want to attach tags or colour labels to chapters so I can visually group acts or arcs in the timeline view.
- As a writer, I want to collapse a chapter row to just its title so the timeline stays scannable when I have many chapters.

---

## Technical Approach

### Key files
- `src/features/timeline/TimelineView.tsx` — top-level list of chapters (133 lines)
- `src/features/timeline/ChapterDetailView.tsx` — per-chapter expanded view with event list + snapshot cards
- `src/features/timeline/ChapterRow.tsx` — single chapter row in `TimelineView`
- `src/features/timeline/EventCard.tsx` — event card in `ChapterDetailView`
- `src/features/timeline/SnapshotCard.tsx` — character snapshot card (location, inventory, notes)
- `src/db/hooks/useTimeline.ts` — `useTimelines`, `useChapters`, `useChapter`, `createChapter`, `updateChapter`, `deleteChapter`, `useEvents`, `createEvent`, `updateEvent`, `deleteEvent`
- `src/types/timeline.ts` — `WorldTimeline`, `WorldChapter`, `WorldEvent`

### Global event ordering
The canonical sort key is computed once and stored on each snapshot record:
```typescript
sortKey = chapter.number * 10_000 + event.sortOrder
```
All snapshot resolution, playback, continuity checks, and the relationship graph use this key — never raw `chapterId` comparisons.

### Snapshot inheritance
When `createEvent` creates a new event (or a new chapter's first event), it copies all snapshot records from the last event of the immediately preceding chapter. This is a full copy — each snapshot gets a new `id` and the new `eventId`.

### ChapterAIDialog
Three-step wizard: (1) paste text, (2) AI parses events + character snapshots, (3) review parsed data, (4) import. The review step shows chapter title, each event with its location, and all character snapshots grouped by event.

---

## Open Questions

- Should multi-timeline worlds allow events to be cross-referenced (e.g. "same day" markers linking events across timelines)?
- Should `sortKey` be recalculated lazily (on read) or eagerly (on write)? Currently eager — stored on the snapshot record.

---

## Tasks

- [x] Timeline / chapter / event CRUD with ordering
- [x] Chapter detail view with per-event snapshot breakdown
- [x] Writer's Notes auto-save per chapter
- [x] Snapshot cards with inventory images
- [x] Snapshot inheritance on chapter/event creation
- [x] Chapter AI dialog (three-step import wizard)
- [x] Event navigation from search palette
- [ ] Multi-select bulk delete / move — see [timeline-multi-select.md](timeline-multi-select.md)
- [ ] Drag chapters between timelines
