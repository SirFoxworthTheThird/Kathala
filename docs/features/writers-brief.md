# Feature: Writer's Brief

## Overview

The Writer's Brief is a slide-in panel that aggregates all the state relevant to the active event in one place. It is intended as a quick reference while writing — open it alongside your writing tool to see who is where, what they're carrying, and how relationships stand at the current chapter.

---

## What Already Works

- **Scroll icon toggle** — clicking the scroll icon in `TopBar` toggles `briefOpen` in the Zustand store; the panel slides in from the right via CSS transition
- **Chapter header** — displays the active chapter title + synopsis; if no chapter is active, shows a prompt to select one
- **Event list** — all events for the active chapter, in `sortOrder` order; active event highlighted; click to jump event cursor
- **Character section** — for each character with a snapshot in the active event:
  - Portrait image, name, alive/dead badge
  - Current location marker name
  - Status notes
  - Inventory items with images (thumbnail grid)
- **Relationship section** — all relationships with a snapshot for the active event:
  - Character names (A ↔ B), sentiment colour badge, strength
- **Items at locations** — items placed at map locations for the active event: item image + name + location name
- **Live updates** — all data via `useLiveQuery` / hooks; panel reflects edits made anywhere else in the app immediately
- **`Section` sub-component** — collapsible section with title, icon, count badge, and children

---

## User Stories

- As a writer, I want to pin the Writer's Brief to remain open while I navigate between views so I always have context visible.
- As a writer, I want to copy the brief as formatted plain text so I can paste it into my writing tool as a chapter outline.
- As a writer, I want the brief to show travel mode for each character so I know how they got where they are.
- As a writer, I want to edit character status notes directly from the brief without opening the full character detail view.

---

## Technical Approach

### Key files
- `src/features/brief/WritersBriefPanel.tsx` — full implementation (254 lines)
- `src/store/index.ts` — `briefOpen`, `setBriefOpen`
- `src/components/AppShell.tsx` — renders `<WritersBriefPanel />` as a fixed overlay

### Data sources
```typescript
const activeEvent    = useEvent(activeEventId)
const chapter        = useChapter(activeEvent?.chapterId ?? null)
const events         = useEvents(activeEvent?.chapterId ?? null)
const snapshots      = useBestSnapshots(worldId, activeEventId)
const relSnaps       = useChapterRelationshipSnapshots(activeEventId)
const itemPlacements = useLiveQuery(...)   // ItemPlacement for activeEventId
```

`useBestSnapshots` provides the most recent character snapshot at or before `activeEventId`, so characters without an override for the exact event still appear with their inherited state.

---

## Tasks

- [x] Slide-in panel toggled by scroll icon in TopBar
- [x] Chapter header with title and synopsis
- [x] Event list with active event highlight and click-to-navigate
- [x] Character section with portrait, location, status notes, inventory thumbnails
- [x] Relationship section with sentiment colour
- [x] Items-at-locations section
- [x] Live updates via hooks
