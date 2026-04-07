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

- [ ] **Maps** — travel modes, distance calculations, `LeafletMapCanvas` improvements
- [ ] **Arc visualization** — richer character arc view (emotion/status curves, multi-character overlay)
- [ ] **Continuity checker expansion** — flag dead characters appearing in later events, items used before acquired, etc.
- [ ] **Timeline multi-select** — select multiple events to bulk-move, delete, or export

---

## Polish

- [ ] **End-to-end UX review** — walk through the app with events as the primary unit; identify rough edges introduced by the Option-A refactor
- [ ] **Empty-state improvements** — new worlds/chapters/events should guide the user toward the next action more clearly
