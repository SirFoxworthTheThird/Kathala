# Feature: Timeline Relationships

## Overview

Timelines can be linked to each other with a typed relationship, enabling multi-layered narrative structures: frame narratives, historical echoes, stories within stories. The map, playback, and timeline bar all become aware of which narrative depth level is active.

The feature is entirely additive. Single-timeline worlds are completely unaffected. No existing data model changes — two new tables are added at database version 14.

**Status: Phase 1 complete (data model + plumbing). Phase 2 (management UI) not yet started.**

---

## Motivation

Some stories operate across multiple temporal layers that are not simply parallel:

- **"The Name of the Wind"** — Kvothe sits at the Inn (present) narrating his own life story (past). Same character, two depth levels. The Inn scenes are a *frame* that contains the life story.
- **"Possession"** — Roland and Maud (1987) investigate the relationship between two Victorian poets (1859). Different characters, same geography, 130 years apart. A letter written in Victorian London is *found* in modern London.

These patterns break the current model where timelines are a flat list of peers. Relationships between timelines carry meaning — and that meaning should shape how the map, playback, and character state panels behave.

---

## Relationship Types

| Type | Description | Anchor |
|---|---|---|
| `frame_narrative` | Timeline A narrates Timeline B. A character in A is the author/narrator of events in B. | Character (the narrator) |
| `historical_echo` | A and B share the same geography across different eras. Locations exist in both; documents can cross. | Location(s) and/or document items |
| `embedded_fiction` | A character in Timeline A writes or tells a story that constitutes Timeline B (fairy tales, plays, prophecies read aloud). | Character (the author) or Item (the text) |
| `alternate` | Timeline B is a branching alternate version of Timeline A — same starting conditions, different outcomes. | Event (the branching point) |

---

## User Stories

- As a writer, I want to link two timelines so the app understands one contains the other, rather than treating them as independent.
- As a writer navigating the inner timeline on the map, I want to see where the narrator is sitting (at the Inn) as a static ghost — so I always know where "now" is while I'm working on "then."
- As a writer working on a historical echo story, I want to see which locations on the map have events in the other era so I can feel the palimpsest of the shared geography.
- As a writer, I want to mark a letter or document as originating in one timeline and being found in another, so the continuity checker can flag inconsistencies.
- As a writer using a frame narrative, I want to mark which inner-timeline events correspond to specific outer-timeline events, so the narrator's position updates automatically as the inner story progresses.
- As a writer with a single timeline, I want none of this to appear — zero additional complexity until I opt in by creating a second timeline and linking it.

---

## Data Model

### New type: `TimelineRelationship`

```typescript
interface TimelineRelationship {
  id: string
  worldId: string
  /** The "outer" or "present" timeline (narrator, present era, or story container) */
  sourceTimelineId: string
  /** The "inner" or "past" timeline (the story being told, or the earlier era) */
  targetTimelineId: string
  type: 'frame_narrative' | 'historical_echo' | 'embedded_fiction' | 'alternate'
  /** What connects these timelines */
  anchors: Array<{
    kind: 'character' | 'location' | 'document'
    entityId: string   // characterId, locationMarkerId, or itemId
  }>
  /**
   * Frame narrative only. Optional mapping from inner-timeline events to the
   * outer-timeline event being narrated at that point. When inner playback
   * reaches a sync point, the outer cursor jumps to the linked outer event.
   */
  syncPoints: Array<{
    innerEventId: string
    outerEventId: string
  }>
  label: string        // e.g. "Kvothe narrates his life", "Victorian London echo"
  description: string
  createdAt: number
  updatedAt: number
}
```

### New type: `CrossTimelineArtifact`

An item that physically exists in one timeline but is encountered (found, read, inherited) in another.

```typescript
interface CrossTimelineArtifact {
  id: string
  worldId: string
  itemId: string
  originTimelineId: string      // where/when the item was created
  encounterTimelineId: string   // where/when the item is found or read
  encounterNotes: string        // e.g. "found in archive box 14", "read as manuscript"
  createdAt: number
  updatedAt: number
}
```

### No changes to existing types

`Timeline`, `Chapter`, `WorldEvent`, `CharacterSnapshot`, `Character`, `Item`, `LocationMarker` — all unchanged. `Timeline` stays a flat label+color record; relationship semantics live in the new table.

### Dexie version 14

Purely additive — two new stores, no migration logic required:

```
timelineRelationships: 'id, worldId, sourceTimelineId, targetTimelineId'
crossTimelineArtifacts: 'id, worldId, itemId, originTimelineId, encounterTimelineId'
```

---

## Behaviour Specification

### Relationship management

- A "Link Timelines" button appears in `TimelineView` only when the world has **2 or more timelines**. Single-timeline worlds never see it.
- Clicking opens a `TimelineRelationshipPanel` slide-over showing existing relationships and a "New Relationship" form.
- Form fields: source timeline, target timeline, type (with a one-line description of each), anchors (type + entity picker — character/location/item from the world), label, description.
- Deleting a relationship does not delete any timelines, chapters, events, or snapshots. It only removes the `TimelineRelationship` record and any `CrossTimelineArtifact` records that reference it.

### Active depth level

When a world has a `frame_narrative` or `embedded_fiction` relationship, a **depth selector** appears in the timeline bar showing two stacked tracks — one per depth level. The outer timeline (source) is the top track; the inner timeline (target) is the bottom track.

The active track determines:
- Which events playback advances through
- Which snapshots the map reads to position characters
- Which chapters appear in the continuity checker scope

Switching tracks is a single click on any event in the other track. The map updates immediately.

### Playback — frame narrative

The two tracks each have their own play button. Playing one track never automatically advances the other.

**Inner track active (the story being told):**
- Playback advances through inner-timeline events only. "Previous" and "next" are always within the inner timeline — the cursor never crosses the depth boundary.
- The outer track's cursor stays frozen wherever the writer left it. Ghost pins (see Map Rendering below) reflect that frozen outer position throughout the entire inner playback session.
- Ghost pins do not animate during inner playback. They represent "where the narrator is right now" — a fixed context anchor, not a moving character.

**Outer track active (the frame / narrator scenes):**
- Playback advances through outer-timeline events only.
- Inner-timeline characters are not shown on the map at all when the outer track is active — only outer-timeline characters are rendered.

**Sync points:**
- On any inner-timeline event, the writer can optionally attach a *sync point* linking it to a specific outer-timeline event. Example: "When the inner story reaches the University fire, Kvothe pauses at the Inn to pour himself a drink — advance the Inn cursor to that event."
- Sync points are created and edited in the `TimelineRelationshipPanel`, not on individual events.
- During inner playback, when the cursor crosses an inner event that has a sync point, the outer cursor **snaps** to the linked outer event. The outer track visually pulses briefly to indicate the jump. Ghost pins update to the new outer snapshot position.
- Sync points are entirely optional. Without them the two tracks are independent, which is perfectly valid for writers who don't need that level of correlation.

### Playback — historical echo

The two timelines are genuinely independent. Playback on the active timeline has no effect on the counterpart timeline. There is no stacked-track UI for historical echo — the timeline bar remains single-track, showing only the active timeline's events.

Echo rings on the map (see Map Rendering below) are **passive** — they reflect which locations have events in the counterpart timeline but do not animate or change with playback. They are always-on context, not a playback artefact.

### Map rendering — frame narrative

When the active depth level is the **inner** timeline (the story being told):

- Characters in the inner timeline render normally (full colour, draggable, respond to active event).
- Characters who are anchors of the `frame_narrative` relationship (the narrator and any co-present characters in the outer timeline) appear as **ghost pins**: dimmed, grayscale, dashed-border markers fixed at their current outer-timeline snapshot position. They do not move during inner-timeline playback.
- Ghost pins are read-only — no drag, no click to edit.
- Hovering a ghost pin shows: "Narrator — [outer timeline name]" and the outer event name they are currently at.
- When a sync point fires during playback and the outer cursor jumps, ghost pins snap to the new position (no animation — a clean cut, like a narrator taking a breath between passages).

When the active depth level is the **outer** timeline (the frame):

- Only outer-timeline characters are shown. Inner-timeline characters are not rendered.

### Map rendering — historical echo

When a `historical_echo` relationship exists between the active timeline and another:

- Locations that have any event recorded in the counterpart timeline show an **echo ring**: a dashed amber circle rendered beneath the location marker.
- Hovering an echo ring shows a tooltip: "This location appears in [other timeline name]."
- Clicking an echo ring opens a popover listing the events that occurred here in the counterpart timeline (read-only).
- Echo rings are always visible regardless of which event is active — they represent the permanent palimpsest of shared geography, not a point-in-time state.

### Cross-timeline artifacts

- Items can be marked as cross-timeline from `ItemDetailView` via an "Appears in another timeline" section.
- When an item with a `CrossTimelineArtifact` record is placed in its **encounter** timeline (the one where it is found), it shows a small "echo era" badge in the map sidebar items list, in event cards that reference it, and in the inventory view.
- The continuity checker gains a new check: if an artifact item appears in an inventory snapshot *before* its `encounterTimelineId` would logically begin (relative to the outer timeline), flag it as an anachronism.

---

## Technical Approach

### Snapshot resolution scoping (the hardest part)

`useBestSnapshots` currently resolves character state across all timelines in a world using a `sortKey = chapter.number × 10_000 + event.sortOrder` formula. This works for a single linear timeline but breaks for frame narratives — Chapter 1 of the outer timeline and Chapter 1 of the inner timeline both have `sortKey ≈ 10001`, causing the resolution to incorrectly treat them as competing for the same character at the same time.

Fix: `selectBestCharacterSnapshots` gains an optional `timelineEventIds?: Set<string>` parameter. When provided, only snapshots whose `eventId` is in the set are considered. The set is derived from all events belonging to the active playback timeline.

All existing call sites pass nothing → unchanged behaviour. For frame narrative rendering, the map calls `useBestSnapshots` twice: once with the inner timeline's event IDs (for the story characters), and once with the outer timeline's event IDs (for the ghost pins).

### `playbackTimelineId` in Zustand

A new `playbackTimelineId: string | null` is added to the store. Its effective value is `playbackTimelineId ?? timelines[0]?.id ?? null`, which exactly reproduces today's behaviour when no relationship is active.

`ChapterTimelineBar`, `MapTimeline`, and `MapExplorerView`'s `orderedEvents` computation all replace their hardcoded `timelines[0]` references with this derived value. `orderedEvents` is also filtered to `e.timelineId === playbackTimelineId` so that `prevEventId` computation never crosses a depth boundary.

### Sync point firing

`ChapterTimelineBar`'s auto-advance logic (and manual next-event navigation) checks whether the new `activeEventId` is the `innerEventId` of any sync point on the active `frame_narrative` relationship. If so, it dispatches `setActiveOuterEventId(syncPoint.outerEventId)` — a new store action that updates the outer track's cursor without switching which track is active. The outer track receives a transient `pulsing: true` CSS class for 600 ms to indicate the jump.

### Timeline bar stacked tracks

The bar height constant `BAR_H` becomes conditional: `BAR_H = hasActiveFrameRelationship ? '6rem' : '3.25rem'`. The callout popover and `AppShell` padding reference `BAR_H` and adjust automatically. The two tracks scroll independently; the active track is visually highlighted with a left border accent. Each track has its own play/pause button; pressing play on one track while the other is playing stops the other.

### Ghost pin rendering

New `makeGhostIcon(pin, zoom)` in `src/lib/ghostMarkerIcon.ts` — same `DivIcon` HTML structure as the existing character group icon but with `opacity: 0.4`, `filter: grayscale(1)`, and a `border-style: dashed` ring. `LeafletMapCanvas` gains a `ghostPins?: CharacterPin[]` prop rendered into a dedicated `ghostMarkersRef` layer group, z-indexed below normal pins. Ghost pins never enter the animation queue.

### Echo ring rendering

New `EchoMarker` interface: `{ markerId: string; position: { x: number; y: number } }`. `LeafletMapCanvas` gains an `echoMarkers?: EchoMarker[]` prop, rendered as Leaflet `CircleMarker` with radius 18, no fill, dashed amber stroke, below the location marker layer. New hook `useEchoLocations(activeTimelineId, worldId)` returns the `Set<string>` of location marker IDs that appear in the counterpart timeline's events (indexed query on `timelineId`, cached with `useMemo`).

### Export / import

`EXPORT_VERSION` bumps to 4. `WorldExportFile` adds `timelineRelationships` and `crossTimelineArtifacts` arrays. Import handles v1–v3 files by defaulting both to `[]`.

---

## Files Affected

### New files

| File | Purpose |
|---|---|
| `src/types/timelineRelationship.ts` | `TimelineRelationship` and `CrossTimelineArtifact` types |
| `src/db/hooks/useTimelineRelationships.ts` | CRUD hooks for both new tables |
| `src/features/timeline/TimelineRelationshipPanel.tsx` | Slide-over UI for managing relationships and sync points |
| `src/lib/ghostMarkerIcon.ts` | Ghost pin `DivIcon` factory |

### Modified files

| File | Change |
|---|---|
| `src/types/index.ts` | Re-export new types |
| `src/types/world.ts` | Add `activeDepthTimelineId` to `AppPreferences` |
| `src/db/database.ts` | Version 14 — two new tables |
| `src/db/hooks/useSnapshots.ts` | Optional `timelineEventIds` scope parameter |
| `src/store/index.ts` | `playbackTimelineId`, `setPlaybackTimelineId`, `activeDepthTimelineId`, `activeOuterEventId`, `setActiveOuterEventId` |
| `src/lib/exportImport.ts` | Version 4, new tables in export/import |
| `src/components/ChapterTimelineBar.tsx` | Replace `timelines[0]`; stacked depth tracks; sync point firing; per-track play buttons |
| `src/features/timeline/TimelineView.tsx` | "Link Timelines" button (2+ timelines only) |
| `src/features/maps/MapExplorerView.tsx` | `playbackTimelineId` scoping; timeline-filtered `orderedEvents`; ghost pins; echo markers |
| `src/features/maps/MapTimeline.tsx` | Replace `timelines[0]` |
| `src/features/maps/LeafletMapCanvas.tsx` | `ghostPins` and `echoMarkers` props and render layers; ghost pins excluded from animation queue |
| `src/features/items/ItemDetailView.tsx` | "Cross-timeline appearances" section |
| `src/features/continuity/ContinuityChecker.tsx` | Artifact anachronism check |
| `src/features/arc/CharacterArcView.tsx` | Scope arc to active playback timeline |
| `src/features/characters/tabs/HistoryTab.tsx` | Annotate snapshots from counterpart timelines |

---

## Tasks

### Phase 1 — Data model + plumbing ✓

- [x] Create `src/types/timelineRelationship.ts` (includes `syncPoints` array on `TimelineRelationship`)
- [x] Update `src/types/index.ts`
- [x] `src/db/database.ts` version 14 — two new tables
- [x] `src/db/hooks/useTimelineRelationships.ts` — CRUD + cascade delete
- [x] `src/store/index.ts` — `playbackTimelineId`, `activeDepthTimelineId`, `activeOuterEventId`
- [x] `src/lib/exportImport.ts` — version 4, v1–v3 import compatibility

### Phase 2 — Relationship management UI

- [ ] `TimelineRelationshipPanel.tsx` — list, create, edit, delete relationships; sync point editor (inner event → outer event picker, per relationship)
- [ ] `TimelineView.tsx` — "Link Timelines" button (2+ timelines gate)
- [ ] `WorldDashboardView.tsx` — relationship count in timeline card

### Phase 3 — Playback scoping

- [ ] Replace all `timelines[0]` references with `usePlaybackTimelineId()` derived helper
- [ ] `ChapterTimelineBar.tsx` — stacked depth tracks for frame narrative; per-track play buttons; sync point firing + outer track pulse animation
- [ ] `AppShell` padding adjustment for variable bar height
- [ ] `src/db/hooks/useSnapshots.ts` — optional `timelineEventIds` scope
- [ ] `MapExplorerView.tsx` — filter `orderedEvents` to `playbackTimelineId`; ensure `prevEventId` never crosses depth boundary

### Phase 4 — Frame narrative map rendering

- [ ] `src/lib/ghostMarkerIcon.ts` — ghost `DivIcon` factory
- [ ] `LeafletMapCanvas.tsx` — `ghostPins` prop + `ghostMarkersRef` layer; exclude from animation queue
- [ ] `MapExplorerView.tsx` — compute ghost pins from outer-timeline snapshots when frame narrative active; re-snap ghost pins on sync point fire

### Phase 5 — Historical echo map rendering

- [ ] `useEchoLocations(activeTimelineId, worldId)` hook
- [ ] `LeafletMapCanvas.tsx` — `echoMarkers` prop + `CircleMarker` ring layer
- [ ] `MapExplorerView.tsx` — compute echo markers; popover on ring click showing counterpart events

### Phase 6 — Cross-timeline artifacts

- [ ] `ItemDetailView.tsx` — "Cross-timeline appearances" section
- [ ] Map sidebar items list — echo era badge
- [ ] `ContinuityChecker.tsx` — artifact anachronism check
- [ ] `HistoryTab.tsx` — counterpart-timeline snapshot annotations
