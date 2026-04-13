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

- [x] **[Maps](docs/features/maps.md)** — waypoint editing, movement annotations, travel mode per movement, distance measurement tool
- [x] **[Arc visualization](docs/features/arc-visualization.md)** — per-character color, inventory sparkline, cell expand, character filter, export to image
- [x] **[Continuity checker expansion](docs/features/continuity-checker.md)** — issue suppression, location-destroyed check, item-before-acquired check, keyboard navigation
- [x] **[Playback — character movement](docs/features/playback.md)** — animated movement along trails, simultaneous movement for shared steps, sub-map transitions with portal fallback, bounds-locked map, timeline horizontal scrolling
- [ ] **[Timeline multi-select](docs/features/timeline-multi-select.md)** — checkboxes, shift-click range, bulk delete/move/tag, drag-to-reorder chapters

---

## Polish

- [ ] **End-to-end UX review** — walk through the app with events as the primary unit; identify rough edges introduced by the Option-A refactor
- [ ] **[Empty-state improvements](docs/features/empty-states.md)** — migrate inline empties to `EmptyState` component; context-aware messaging; zero-data vs. filtered-to-zero distinction
