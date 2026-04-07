# Feature: Maps

## Overview

The map system lets users upload custom/fantasy map images and track where characters, items, and locations are at each point in the story. It uses Leaflet with `CRS.Simple` (pixel coordinates) so any image can be used as a map. Characters move visually between events as the active event changes.

The core is already well-developed. This document focuses on the remaining gaps.

---

## What Already Works

- Upload map images; Leaflet renders them with pixel coordinates (`CRS.Simple`)
- Location markers (city, town, dungeon, landmark, building, region, custom) with status badges
- Character pins showing portraits/initials, grouped when co-located, drag-to-reposition
- Snap-to-location when dropping a character pin (60 px threshold)
- Sub-maps via `linkedMapLayerId` — drill into a region and navigate back via breadcrumb history
- Scale calibration (click two points to set pixels-per-unit + unit label)
- Movement lines: waypoint (dashed, within chapter) and travel (solid, between chapters), with distance labels
- Timeline playback: animates character movement across events with configurable speed
- Event-based filtering: all pins/lines reflect the state at the active event
- Item placements at locations with per-event state tracking

---

## User Stories

- As a writer, I want to record a character's travel route (ordered waypoints) so I can visualise the journey and check travel time against the story.
- As a writer, I want to annotate a movement with a reason (e.g. "fleeing the siege") so I remember why a character moved.
- As a writer, I want to reorder waypoints mid-path, not just append/remove the last one.
- As a writer, I want to set which travel mode a character used for a specific movement (horse, boat, on foot) so the continuity checker can use the right speed.
- As a writer, I want a measurement tool I can drag across the map to get a distance readout, separate from scale calibration.

---

## Technical Approach

### Key files
- `src/features/maps/LeafletMapCanvas.tsx` — core renderer (662 lines); all marker/pin/animation logic lives here
- `src/features/maps/MapExplorerView.tsx` — layout shell + character/location sidebars
- `src/features/maps/MapTimeline.tsx` — event navigation bar at the bottom
- `src/db/hooks/useMovements.ts` — CRUD for `CharacterMovement` records
- `src/types/map.ts` — `MapLayer`, `LocationMarker`
- `src/types/movement.ts` — `CharacterMovement` (has `waypoints: string[]` = ordered `locationMarkerIds`)
- `src/types/travelMode.ts` — `TravelMode` (`speedPerDay`, `name`)

### CharacterMovement schema
```typescript
CharacterMovement {
  id, worldId, characterId, eventId
  waypoints: string[]   // ordered locationMarkerIds
  createdAt, updatedAt
}
```
`travelModeId` lives on `CharacterSnapshot`, not on `CharacterMovement` — the character's active travel mode at a snapshot is what the continuity checker reads.

### Waypoint editing
Current UI only supports appending/removing the last waypoint. To support full reorder, the waypoint list in `LeafletMapCanvas` or a side panel needs a drag-sortable list (e.g. `@dnd-kit/sortable`) that calls `updateMovement(id, { waypoints: newOrder })`.

### Movement annotations
Add an optional `notes: string` field to `CharacterMovement` in `src/types/movement.ts` and a new Dexie `.version(N)` migration. Surface the field as a textarea in the movement detail panel.

### Travel mode per movement
Currently `travelModeId` is on the snapshot, meaning one mode per event regardless of which leg of the journey. A cleaner model: add `travelModeId: string | null` to `CharacterMovement` directly. Migration: add field with `null` default. The continuity checker would then read `movement.travelModeId ?? snapshot.travelModeId` as a fallback.

### Distance measurement tool
A Leaflet draw-like tool: on activation, click two points on the canvas and compute pixel distance → divide by `scalePixelsPerUnit` → display in `scaleUnit`. Can be implemented as a temporary polyline with a tooltip, no DB writes needed.

---

## Open Questions

- Should movement annotations be on `CharacterMovement` (per journey) or on `WorldEvent` (per event)? Per movement feels more natural for travel reasons.
- Should travel mode on a movement override the snapshot's travel mode for continuity purposes, or should they remain separate?
- Is full waypoint reordering needed for v1, or is append/remove-last sufficient for most stories?

---

## Tasks

- [x] **Waypoint reorder UI** — up/down buttons on each waypoint in the Journey section of `CharacterSnapshotPanel`; calls `updateMovement`
- [x] **Movement annotations** — `notes: string` added to `CharacterMovement` type + Dexie v11 migration + textarea in Journey section
- [x] **Travel mode per movement** — `travelModeId` added to `CharacterMovement`; dropdown in Journey section; continuity checker now prefers `movement.travelModeId` over `snapshot.travelModeId`
- [ ] **Distance measurement tool** — click-two-points tool on canvas; shows distance readout; no DB writes
- [x] **Empty state for MapTimeline** — shows a guidance message when no chapters exist instead of rendering nothing
