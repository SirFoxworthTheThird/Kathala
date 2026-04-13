# Feature: Playback — Character Movement

## Overview

When the user presses Play on the `ChapterTimelineBar`, the app advances the story event-by-event. Character movements are animated on the map: pins travel along the waypoint trails drawn by the user, with simultaneous movement for characters sharing the same step, and full sub-map transition support.

**Status: implemented.** See Tasks section for remaining polish items.

---

## What Is Implemented

- `ChapterTimelineBar` drives playback: auto-advances `activeEventId` through all events in global order (`chapter.number × 10_000 + sortOrder`); `isAnimating` flag gates the auto-advance timer
- `buildSequentialQueue` in `MapExplorerView` groups character moves by shared `(prevLayerId, prevMarkerId, currLayerId, currMarkerId)` key → one `PlaybackStep` per group → characters in the same group animate simultaneously
- `LeafletMapCanvas` runs the animation via `requestAnimationFrame`; `runningAnimKeyRef` prevents re-entrancy; `Number.isFinite` guards on all coordinates
- Trail resolution: waypoints from `CharacterMovement.waypoints` → pixel path; fallback straight line when no movement record exists
- Sub-map transitions: `firstWaypointOnLayer` / `lastWaypointOnLayer` helpers provide fallback entry/exit points when no portal marker exists (since `linkedMapLayerId` is one-directional)
- Map bounds: image perfectly fills canvas at min zoom; `setMinZoom` + `setMaxBounds` lock panning to image boundaries
- Timeline horizontal scroll: mouse-wheel converts to horizontal, left/right arrow buttons appear when content overflows
- `playbackSpeed` (`slow` / `normal` / `fast`) controls both animation speed (px/s) and reading hold duration

---

## User Stories

- As a reader, I want to watch characters move across the map as the story plays so I can follow the narrative spatially.
- As a reader, I want the camera to zoom in and follow each character as they travel so the movement is easy to read.
- As a reader, I want characters to travel along the trails I drew, not just teleport between locations.
- As a reader, I want to see characters exit sub-maps, cross the parent map, and enter other sub-maps so transitions feel coherent.
- As a reader, I want new characters appearing for the first time to fade in at their starting location.

---

## Behaviour Specification

### Playback granularity

- Advance **event-by-event** when events exist on the active timeline.
- Fall back to **chapter-by-chapter** only for chapters that have no events at all.
- This is already how `ChapterTimelineBar` works; no change needed here.

### Movement sequence per event transition

When `activeEventId` advances from event **N** to event **N+1**:

1. Collect all characters whose `currentLocationMarkerId` or `currentMapLayerId` changed between the two events.
2. Sort them by some stable order (e.g., character name alphabetically) so the sequence is deterministic.
3. Animate them **one at a time** — the next character's movement begins only after the previous one finishes.
4. Once all movements complete, the playback hold timer (`readingHoldMs`) starts and the event callout is shown, then the cursor advances again.

### Per-character movement animation

**Source**: `CharacterSnapshot` at event N → `currentLocationMarkerId` + `currentMapLayerId`  
**Destination**: `CharacterSnapshot` at event N+1 → `currentLocationMarkerId` + `currentMapLayerId`

**Trail lookup**: Find the `CharacterMovement` record for this character at event N+1. Its `waypoints` array (ordered locationMarkerIds) defines the path. If no `CharacterMovement` exists, interpolate in a straight line directly between source and destination markers.

**Animation steps**:
1. Camera flies to the character's starting marker (zoom in).
2. The character marker moves along the trail waypoints at a constant speed (pixels/second, scaled by `playbackSpeed`).
3. Camera follows the marker continuously.
4. On arrival, the marker settles at the destination; brief pause (≈ 400 ms), then next character starts.

**First appearance** (no snapshot at event N, or `currentLocationMarkerId` was null):  
The character marker fades in (opacity 0 → 1, ~300 ms) at the destination. No movement animation.

**Disappearance** (character `isAlive: false` after this event):  
The character marker fades out (opacity 1 → 0, ~300 ms) after arriving.

### Sub-map transitions

A character may move between a sub-map and its parent, or between two different sub-maps. Three cases:

#### Case A — Sub-map → Parent map

1. Camera follows character to the edge of the sub-map (nearest point on the map's bounding box in the direction of the destination).
2. **Instant cut**: switch view to the parent map layer, placing the character marker at the corresponding sub-map entry marker on the parent.
3. Continue animating the character along the remaining trail to the destination on the parent map.

#### Case B — Parent map → Sub-map

1. Animate character along the trail on the parent map until it reaches the entry marker for the target sub-map.
2. **Instant cut**: switch view to the sub-map layer, placing the character marker at the entry point of the sub-map.
3. Continue animating to the final destination inside the sub-map.

#### Case C — Sub-map A → Sub-map B (different parent link)

1. Case A: exit sub-map A to parent.
2. Animate across parent map.
3. Case B: enter sub-map B.

**Edge exit point calculation** (Case A step 1):  
Given the character's current pixel position and the destination marker's pixel position (projected onto the parent map), compute the direction vector. Intersect this ray with the sub-map's bounding rectangle (the image bounds of the `MapLayer`). The intersection point is the exit position.

**Sub-map entry marker**:  
A location marker on the parent map that has a `linkedMapLayerId` pointing to the sub-map counts as the entry/exit portal for that sub-map. The character's position on the parent map when entering/exiting the sub-map is the `(x, y)` of this portal marker.

---

## Technical Approach

### Architecture

The animation logic lives in a new hook `usePlaybackAnimation` that the `MapExplorerView` (which hosts `LeafletMapCanvas`) consumes. It is driven by changes to `activeEventId` when `isPlayingStory` is true.

The `ChapterTimelineBar`'s existing auto-advance timer should be **paused** while animations are running. A new Zustand flag `isAnimating: boolean` signals this. The timer in `ChapterTimelineBar` only fires when both `isPlayingStory` is true **and** `isAnimating` is false.

```
store:
  isAnimating: boolean          ← new; set true while character moves, false when done
  setIsAnimating: (v) => void
```

### Animated character marker

`LeafletMapCanvas` currently renders static `CharacterMarker` components. For playback, each moving character needs a separate animated overlay marker whose position is updated frame-by-frame via `requestAnimationFrame`. When not animating, markers render at their snapshot position as today.

```
// New prop on LeafletMapCanvas (or a sibling overlay)
animatingMarkers?: {
  characterId: string
  path: [number, number][]   // pixel [y, x] waypoints along full trail
  progress: number           // 0–1 along path
}[]
```

### Trail path resolution

```typescript
function resolveTrailPath(
  fromMarker: LocationMarker,
  toMarker: LocationMarker,
  movement: CharacterMovement | undefined,
  markerById: Map<string, LocationMarker>,
): [number, number][]   // [y, x] pixel coords
```

- If `movement?.waypoints` is non-empty: map each waypointId → marker `(x, y)`, prepend `fromMarker`, append `toMarker`.
- Otherwise: `[[fromMarker.y, fromMarker.x], [toMarker.y, toMarker.x]]`.

### Camera follow

Use `map.panTo([y, x])` on each animation frame when the animated marker is near the edge of the viewport. Or use `map.flyTo` at the start of each character's turn to zoom to their origin before movement begins. Do not re-fly during movement — only pan to keep the marker visible.

### Speed mapping

| `playbackSpeed` | px/second |
|---|---|
| `slow` | 80 |
| `normal` | 160 |
| `fast` | 320 |

Duration of a movement segment = `pathLengthPx / speedPxPerSec`.

---

## Key Files

| File | Role |
|---|---|
| `src/components/ChapterTimelineBar.tsx` | Add `isAnimating` guard to auto-advance timer |
| `src/store/index.ts` | Add `isAnimating` + `setIsAnimating` |
| `src/features/maps/MapExplorerView.tsx` | Consume `usePlaybackAnimation`; pass animated markers + camera commands to canvas |
| `src/features/maps/LeafletMapCanvas.tsx` | Render animated marker overlays; expose camera control ref |
| `src/features/maps/usePlaybackAnimation.ts` | New hook — computes movement queue, runs RAF loop, handles sub-map transitions |

---

## Resolved Decisions

- **Static vs animated marker**: the static snapshot marker is hidden while the animated marker is active. There is always only one marker per character on screen.
- **Map not open during playback**: the app auto-navigates to the map view when Play is pressed (or when the first animated transition begins).
- **No trail defined**: characters with no `CharacterMovement` record still animate — they slide in a straight line between the two markers.
- **Skipping**: not in scope for now.

---

## Tasks

- [x] Add `isAnimating` flag to Zustand store; guard auto-advance in `ChapterTimelineBar`
- [x] `buildSequentialQueue` in `MapExplorerView` — collect character moves, group by shared `(prevLayer, prevMarker, currLayer, currMarker)` into simultaneous steps, resolve trail paths with `validCoords` guards
- [x] Animated marker overlay in `LeafletMapCanvas` — RAF-driven position update via `requestAnimationFrame`; `runningAnimKeyRef` guard prevents re-entrancy
- [x] Sub-map cross-layer animation — `firstWaypointOnLayer` / `lastWaypointOnLayer` fallback chain when no portal marker exists (one-directional `linkedMapLayerId`)
- [x] React-leaflet v5 async map init — `MapInstanceTracker` component using `useMap()` inside `MapContainer`; map instance passed via `onReady` callback and added to animation effect deps
- [x] Tight image bounds — `FitBounds` sets `minZoom` from `getBoundsZoom` and calls `setMaxBounds`; `minZoom={-3}` and padded `maxBounds` removed from `MapContainer`
- [x] Infinite-loop fix — `useBestSnapshots` result wrapped in `useMemo`; `useWorldBlobUrls` map wrapped in `useMemo`; `charPins` in `MapExplorerView` wrapped in `useMemo`
- [ ] Fade-in for first appearance; fade-out on character death
- [ ] Skipping / scrubbing
