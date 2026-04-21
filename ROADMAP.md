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
- [x] **[Export / Import](docs/features/export-import.md)** — .pwk v4 format, backward compat, sortKey backfill
- [x] **[Themes](docs/features/themes.md)** — nine themes, CSS variable injection, per-theme fonts and overlays
- [x] **[Timeline multi-select](docs/features/timeline-multi-select.md)** — checkboxes, shift-click range, bulk delete/move/tag, drag-to-reorder chapters

- [x] **[Timeline Relationships](docs/features/timeline-relationships.md)** — typed links between timelines (frame narrative, historical echo, embedded fiction, alternate); ghost pins on map for frame anchors; palimpsest echo rings for shared geography; cross-timeline artifacts; depth-scoped playback
  - [x] Phase 1: data model + plumbing (types, DB v14, CRUD hooks, store fields, export v4)
  - [x] Phase 2: relationship management UI (panel, "Link Timelines" button, dashboard tile)
  - [x] Phase 3: playback scoping
  - [x] Phase 4: frame narrative map rendering (ghost pins)
  - [x] Phase 5: historical echo map rendering (echo rings)
  - [x] Phase 6: cross-timeline artifacts

---

## Architectural Work

Technical debt and structural improvements identified in architectural review. Tackle in order — each is a prerequisite or low-risk warmup for the next.

- [x] **Fix DB version declaration order** — swap `version(13)` and `version(14)` blocks in `src/db/database.ts` so versions read 10→11→12→13→14 in source order. Dexie sorts at runtime so this is cosmetic, but the current order misleads anyone adding a v15. 2-line change.

- [x] **Fix `resolveCharacterPin` return type** — add `ResolvedPinPosition` type alias in `src/features/maps/MapExplorerView.tsx`; remove two `null as unknown as Character` casts from the function body. Callers already overwrite `character` immediately. ~10-line change.

- [x] **Extract shared `selectBestSnapshots` generic** — create `src/lib/snapshotUtils.ts` with one generic `selectBestSnapshots<T>` utility; wire it into the four hook files that each copy the same "highest sortKey at or before active event" algorithm (`useSnapshots`, `useLocationSnapshots`, `useItemSnapshots`, `useRelationshipSnapshots`). Rename the existing `selectBestSnapshots` export in `useRelationshipSnapshots.ts` to `selectBestRelationshipSnapshots` first to avoid import collision. Public signatures unchanged; no downstream breakage.

- [x] **Fix Rules of Hooks violation in `ChapterTimelineBar.tsx`** — two `useMemo` calls (`outerEventsByChapter`, `innerEventsByChapter`) were inside an `if (frameRel)` block, causing a "rendered more hooks than previous render" crash when linking timelines. Moved both to unconditional component top level.

- [x] **Split `ChapterTimelineBar.tsx`** (844 lines) — created `src/components/timeline/` directory:
  - `TimelineControls.tsx` — controls row + event panel display
  - `TimelineScrubber.tsx` — chapter segment scrubber
  - `StackedTrack.tsx` — frame narrative dual-track component
  - `SingleTrack.tsx` — single-track render
  - `src/features/timeline/useTimelinePlayback.ts` — playback `useEffect` + `handlePlayPause`

- [x] **Redesign `ChapterTimelineBar` visuals** — rework from scrubber-style dots to a chapter-segment strip:
  - **Single-track**: chapters as proportional-width labeled segments (width ∝ event count); fill bar advances per event; tick marks for individual events with hover tooltip; chapter title truncated below segment. Replaces the tiny numbered dot + `1.1`/`1.2` event labels.
  - **Active event display**: fixed "Ch.N — Title › Event Title" panel between controls and track, always visible. Replaces the 4-second disappearing callout.
  - **Stacked (frame narrative)**: frame track rendered as a visually thinner strip (30px) with a `FRAME` badge; story track is the main full-height track with a `STORY` badge. A vertical ghost cursor line spans both tracks at the active frame event, showing temporal correspondence. Clicking either track activates it. Replaces the indistinguishable same-height rows with colored left-border indicator.
  - **"All" button** renamed to "Clear" or removed in favour of clicking the active event dot to deselect.

- [x] **Split `MapExplorerView.tsx`** (1,867 lines) — create focused files in `src/features/maps/`:
  - `mapUtils.ts` — `buildSequentialQueue`, `resolveCharacterPin`, constants (pure, no React)
  - `SetScaleDialog.tsx` — scale calibration dialog
  - `MapFilterBar.tsx` — `MapFilters` type, `DEFAULT_MAP_FILTERS`, filter bar UI (preserve exports for existing consumers)
  - `MapSidebar.tsx` — all six sidebar section components under one `<MapSidebar>` wrapper
  - `usePlaybackQueue.ts` — playback queue state + effects
  - `useMapViewState.ts` — all data-fetching hooks and derived memos from `MapView`
  - After extraction `MapView` handles only local UI state, event handlers, and canvas/panel JSX (~400 lines).

---

## Map Enhancements

New capabilities identified in the maps UX review. Detailed specs in `docs/features/maps.md`.

- [x] **Location sidebar search** — filter input at the top of the Locations section in the map sidebar; filters the visible list by name in real time. Very low effort.

- [x] **Label density toggle** — a button in the map header (or filter bar) to switch between "labels on" and "dots only" mode; reduces clutter when zoomed out on large maps. Very low effort.

- [x] **Full character journey trail** — toggleable per-character overlay showing their complete path across *all* chapters (not just the previous chapter → current). Reads all snapshots for a character in order and draws a faded polyline through every location they visited.

- [x] **Character path film strip** — clicking a character pin shows a horizontal timeline strip at the bottom of the map listing every location that character visited in chapter order; clicking a stop jumps to that chapter.

- [x] **Persistent routes between locations** — Routes section in sidebar; click-marker draw mode; styled polylines by route type (road, river, trail, sea route, border, custom); DB v15.

- [x] **Region polygon support** — Regions section in sidebar; click-canvas draw mode with live preview; filled polygons with per-event status; DB v15.

- [x] **Map export as image** — Export button in map header; uses `html2canvas` to capture the Leaflet container as PNG.

### Map Routes & Regions — Depth Pass

- [x] **Region status editing UI** — Inline status picker in sidebar when a region is selected and an event is active; calls `upsertMapRegionSnapshot` so status changes are saved per-event. Also shows a notes field.
- [x] **Region snapshot inheritance** — `useBestRegionSnapshots` follows the standard best-snapshot pattern (highest sortKey ≤ active event) so a region keeps its last-recorded status rather than reverting to "active" at every new event.
- [x] **Canvas click → select route / region** — Clicking a route polyline or region polygon on the canvas selects it in the sidebar (highlights the row, same as clicking the sidebar entry).
- [x] **Route & region detail panel** — Slide-in panel (matching `LocationDetailPanel`) for a selected route/region: rename, edit notes, and for routes change the route type and waypoints list; for regions change fill color and opacity.
- [x] **Continuity checker route integration** — When checking travel time between two locations, look up any direct route between them and apply route-type speed multipliers (road fastest, trail slowest); surface a warning when a character traverses a `destroyed` or `abandoned` border region.
- [x] **Character movement follows routes** — During playback, if a MapRoute exists on the same layer connecting a character's previous and current location markers, the pin animates along the route geometry instead of a straight line. Manual `CharacterMovement` waypoints take priority; route geometry is the automatic fallback.

---

## New Feature Work

### Loose Ends

- [x] **Travel mode visible in timeline** — the History tab and CharacterDetailView show snapshot state but omit travel mode; surface `travelModeId` in the History tab entry for each event where a snapshot was recorded. Also show it in the continuity checker travel-time detail message (currently only shows speed, not which mode name was used).

### Map

- [x] **Map annotations / free-text labels** — ability to place text labels (or sticky notes) directly on the map canvas, independent of location markers. Stored as a new `MapAnnotation` table (worldId, mapLayerId, x, y, text, fontSize, color); shown as non-interactive overlays on the Leaflet canvas; editable via a small inline popover on click. DB v16.

- [x] **Region sub-map links** — regions gain an optional `linkedMapLayerId` (DB v17 backfill); a "⤵" badge marker rendered at the polygon centroid drills down on click; linked regions show a chain-link icon in the sidebar; the Region Detail Panel gets a sub-map picker with a clear button.

- [x] **Context menu expansion** — right-click on the map canvas offers: Add Location (existing), Add Label (creates annotation immediately), Start Route here (enters route-draw mode with first waypoint set), Start Region here (enters region-draw mode with first vertex set), Copy coordinates (copies `x, y` to clipboard). Menu suppressed during active draw modes.

---

## New Major Features

- [x] **[Lore](docs/features/lore.md)** — wiki-like pages for world-building information that isn't time-varying (magic systems, history, religions, terminology, etc.). Free-form markdown editor, user-defined categories, full-text search, links from characters/locations/items, included in `.pwk` export and HTML export. New DB tables: `lorePages`, `loreCategories` (v19). Also added: timeline visibility filter ("Revealed at" event), entity backlinks (characters, items, locations), Writer's Brief integration, Related Lore tabs on character/item/location panels.

- [x] **[Factions](docs/features/factions.md)** — named groups with event-scoped character membership (allegiances change over time). DB v21 (factions, factionMemberships) + v22 (MapRegion factionId backfill) + v23 (factionId index on mapRegions) + v24 (factionId on locationMarkers). Factions view with roster and member management; character Factions tab (membership CRUD, role/start/end event per membership); owning-faction picker on both map regions and location markers; Territories section in faction panel lists owned regions and locations; Arc View faction overlay toggle (colored cell borders + footer legend); relationship graph faction overlay toggle (colored node borders + faction badge on nodes + legend); faction badges on character cards in Writer's Brief; "Factions in scene" section in Writer's Brief; factions included in Ctrl+K search; .pwk export v6 and HTML export factions section (including location marker faction labels).

### Factions — Depth Pass

- [ ] **Faction-aware continuity checks** — add two new checks to the Continuity checker: (1) a character is at a location controlled by a hostile faction at that event (requires a way to mark faction relationships as hostile); (2) a character's faction membership has a gap — they leave one faction but join no other, which may be intentional or an oversight. Surface as low-priority warnings with suppress support.

- [ ] **Faction Arc View** — a new tab or toggle in Arc View showing faction membership across the timeline: one row per faction, one column per event, cells filled with member names (or avatars) who were active members at that event. Useful for visualising how faction composition shifts.

- [ ] **Faction tags UI** — the `Faction` type already has a `tags: string[]` field but there is no UI to add or remove tags. Add a tag bar to the `FactionDetailPanel` (same pill + X + input pattern used on characters and items).

---

### Search

- [x] **Search palette covers routes & regions** — extend the Ctrl+K search palette to include MapRoute and MapRegion as two new entity types (with Route / Hexagon icons); selecting a result navigates to the Maps view and focuses the selected route or region (same `focusOnRoute` / `focusOnRegion` logic already used in the sidebar).

### Character

- [x] **History tab enrichment** — for each snapshot entry in the History tab, show travel mode (name, not just ID), route used (if a MapRoute connects the previous and current location on the same layer), and straight-line distance covered. Makes the tab genuinely informative instead of just a state dump.

### Continuity

- [x] **Continuity checker: character inside destroyed/occupied region** — complement the existing "traverses destroyed region" check with a stationary check: if a character's snapshot places them at a location that is *inside* a region with status `destroyed` or `occupied` at that event, surface a warning. Uses the same `pathCrossesPolygon` geometry already in the checker (point-in-polygon case).

### AI

- [x] **Map AI dialog — extract location moves from prose** — a "paste travel narrative" dialog on the Maps view; sends the pasted text plus the current map's location list to Claude; returns a structured list of character → location assignments per event; previews the moves before applying them as snapshots. Mirrors the chapter AI dialog pattern.

---

## UX Improvements

Findings from the UX audit (April 2026).

- [x] **Icon-only navigation** — TopBar nav items now show icon + text label
- [x] **Platform keyboard shortcut** — Search bar shows `Ctrl+K` on Windows/Linux, `⌘K` on Mac
- [x] **Writer's Brief and Continuity Checker discoverability** — styled with text labels and a separator; no longer icon-only
- [x] **ChapterTimelineBar hidden on Arc and Settings** — playback bar suppressed on views where chapter selection is not meaningful
- [x] **All `confirm()` dialogs replaced** — 12 native browser confirms replaced with `ConfirmDialog` component
- [x] **WorldSelector import hint** — hint text only shown while importing, not always
- [x] **Travel modes moved to Settings** — extracted from the Dashboard into a dedicated `WorldSettingsView` at `/settings`; Settings nav item added to TopBar

---

## Polish

- [x] **End-to-end UX review** — walk through the app with events as the primary unit; identify rough edges introduced by the Option-A refactor
- [x] **[Empty-state improvements](docs/features/empty-states.md)** — migrate inline empties to `EmptyState` component; context-aware messaging; zero-data vs. filtered-to-zero distinction

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
