# PlotWeave Roadmap

Post Option-A refactor, all items in NEXT_STEPS.md are complete.
The ChapterDetailView critical bug (character/relationship state panels always empty) was also fixed — `useEventSnapshots(lastEventId)` and `useEventRelationshipSnapshots(lastEventId)` now correctly drive those panels.

---

## Immediate / Housekeeping

- [x] **Run full test suite** — verify nothing regressed from all recent changes (`npm run test` + `npx playwright test`)
- [x] **Archive NEXT_STEPS.md** — all items are done; move or delete it to avoid confusion

---

## Short-term Improvements

- [x] **ChapterDetailView per-event breakdown** — "Character States" now shows one collapsible section per event; each section lists all character snapshots for that event. Characters with no snapshot in the entire chapter are listed at the bottom.

- [x] **SearchPalette event navigation** — selecting an event result now calls `setActiveEventId` before navigating, so the timeline cursor jumps to that exact event.

- [x] **ChapterAIDialog snapshot review UI** — added a 3rd "Review" step between paste and import; shows chapter summary, each event with its location, and all character snapshots (name, alive status, location, status notes) grouped by event.

---

## Feature Work

Detailed specs live in `docs/features/`:

- [x] **[Worlds](docs/features/worlds.md)** — multi-world support, dashboard, travel mode management
- [x] **[Maps](docs/features/maps.md)** — waypoint editing, movement annotations, travel mode per movement, distance measurement tool
- [x] **[Characters](docs/features/characters.md)** — roster, snapshot tabs, portrait images, per-character colour
- [x] **[Relationships](docs/features/relationships.md)** — ReactFlow graph, sentiment/strength, event-scoped, per-event overrides
- [x] **[Timeline](docs/features/timeline.md)** — chapters, events, snapshot cards, writer's notes, AI dialog
- [x] **[Items](docs/features/items.md)** — catalogue, per-event inventory and placement, item images
- [x] **[Arc visualization](docs/features/arc-visualization.md)** — per-character color, inventory sparkline, cell expand, character filter, export to image
- [x] **[Continuity checker expansion](docs/features/continuity-checker.md)** — issue suppression, location-destroyed check, item-before-acquired check, keyboard navigation
- [x] **[Playback — character movement](docs/features/playback.md)** — animated movement along trails, simultaneous movement for shared steps, sub-map transitions with portal fallback, bounds-locked map, timeline horizontal scrolling
- [x] **[Chapter Timeline Bar](docs/features/chapter-timeline-bar.md)** — chapter/event dots, callout, playback controls, horizontal scrolling, diff trigger
- [x] **[Search](docs/features/search.md)** — Ctrl+K palette, 7 entity types, grouped results, keyboard navigation
- [x] **[Writer's Brief](docs/features/writers-brief.md)** — slide-in panel, chapter summary, live updates
- [x] **[Chapter Diff](docs/features/chapter-diff.md)** — compare any two chapters, character/relationship/item diffs
- [x] **[Export / Import](docs/features/export-import.md)** — .pwk v3 format, backward compat, sortKey backfill
- [x] **[Themes](docs/features/themes.md)** — nine themes, CSS variable injection, per-theme fonts and overlays
- [ ] **[Timeline multi-select](docs/features/timeline-multi-select.md)** — checkboxes, shift-click range, bulk delete/move/tag, drag-to-reorder chapters

---

## Polish

- [x] **End-to-end UX review** — walk through the app with events as the primary unit; identify rough edges introduced by the Option-A refactor
- [ ] **[Empty-state improvements](docs/features/empty-states.md)** — migrate inline empties to `EmptyState` component; context-aware messaging; zero-data vs. filtered-to-zero distinction

---

## UX Review — Post Option-A Fixes

Findings from the end-to-end review. Bugs first, then copy/polish.

### Bugs (broken behavior)

- [x] **ChapterRow "Set Active" passes chapter ID to event setter** (`src/features/timeline/ChapterRow.tsx:24,72`)
  `isActive = chapter.id === activeEventId` always evaluates false (different ID namespaces). Clicking "Set Active" calls `setActiveEventId(chapter.id)`, pushing a chapter ID into an event-ID field — corrupts store state. Fix: derive `isActive` from whether the active event belongs to this chapter; on click, select the chapter's first event (mirrors `selectChapter()` in ChapterTimelineBar).

- [x] **HistoryTab calls `useChapter(eventId)` — always returns undefined** (`src/features/characters/tabs/HistoryTab.tsx:31`)
  `useChapter` queries `db.chapters.get(id)`, so passing an event ID always resolves to `undefined`. The fallback renders the raw UUID. Fix: look up the event, then its chapter — show something like "Ch. 2 — The Shire / The Ambush".

- [x] **ContinuityChecker navigate paths use eventId where chapterId is required** (`src/features/continuity/ContinuityChecker.tsx:213,263,318,353,384,419,476`)
  All `navigatePath` values are built as `/worlds/${worldId}/timeline/${snap.eventId}`, but the route is `/timeline/:chapterId`. Clicking "Go to issue" 404s or opens the wrong chapter. Fix: resolve `eventById.get(id)?.chapterId` and use that in every `navigatePath`.

- [x] **Event deletion has no confirmation guard** (`src/features/timeline/EventCard.tsx:182`, `EventRow.tsx:94`)
  Every other destructive delete (chapter, character, item, location, world) uses `confirm()`. Event deletion is instant and silent, orphaning any character/item/relationship snapshots for that event (which the continuity checker then flags). Fix: add `if (!confirm(...)) return` consistent with the rest of the app.

- [x] **WritersBrief relationship section ignores inherited state** (`src/features/brief/WritersBriefPanel.tsx:45`)
  Uses `useChapterRelationshipSnapshots(activeEventId)` — an exact-match query. A relationship last recorded at event 3 shows as absent at event 5. Character and item sections correctly show inherited state; relationships don't. Fix: replace with `useBestRelationshipSnapshots(worldId, activeEventId)`.

### Stale copy ("chapter" where "event" is meant)

- [x] **CurrentStateTab empty state** (`src/features/characters/tabs/CurrentStateTab.tsx:64`) — "Select a chapter from the top bar" → "Select an event from the timeline bar"
- [x] **WritersBriefPanel empty state** (`src/features/brief/WritersBriefPanel.tsx:116`) — "Select a chapter from the timeline bar" → "Select an event from the timeline bar"
- [x] **HistoryTab empty state** (`src/features/characters/tabs/HistoryTab.tsx:88`) — "Select a chapter and save state" → "Select an event and save state"

### UX rough edges

- [x] **Character detail defaults to the event-gated tab** (`src/features/characters/CharacterDetailView.tsx:82`)
  `defaultValue="state"` opens on "Current State", which immediately shows a blank placeholder when no event is active. New users opening a character see a dead screen. Fix: change to `defaultValue="overview"`.

- [x] **Chapter pill with no events silently does nothing** (`src/components/ChapterTimelineBar.tsx:154`)
  `selectChapter()` exits early with no feedback when a chapter has no events. The pill looks clickable but does nothing. Fix: visually dim empty-chapter pills and add a tooltip — "Add an event to this chapter to activate it."

- [x] **Playback forces navigation to Maps without warning** (`src/components/ChapterTimelineBar.tsx:194`)
  Pressing Play from any view immediately navigates to Maps. Intentional (trails are on the map), but jarring when in Characters or Timeline. Fix: add a tooltip to the play button — "Plays story movement on the map."
