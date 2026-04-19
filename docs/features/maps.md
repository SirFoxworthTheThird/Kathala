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

## Decisions

- Movement annotations live on `CharacterMovement` (per journey), not on `WorldEvent`.
- Travel mode on a movement overrides the snapshot's travel mode for continuity; snapshot is the fallback.
- Full waypoint reordering is supported (up/down buttons on each waypoint).
- Region polygon status (occupied, destroyed, etc.) is tracked per chapter/event, same model as location marker status.
- Route type affects continuity checker travel time — a road is faster than wilderness; the checker will apply a per-route-type speed multiplier against the character's travel mode speed.

---

## Tasks

- [x] **Waypoint reorder UI** — up/down buttons on each waypoint in the Journey section of `CharacterSnapshotPanel`; calls `updateMovement`
- [x] **Movement annotations** — `notes: string` added to `CharacterMovement` type + Dexie v11 migration + textarea in Journey section
- [x] **Travel mode per movement** — `travelModeId` added to `CharacterMovement`; dropdown in Journey section; continuity checker now prefers `movement.travelModeId` over `snapshot.travelModeId`
- [x] **Distance measurement tool** — click-two-points tool on canvas; shows distance readout; draws cyan dashed polyline with label on canvas; no DB writes
- [x] **Empty state for MapTimeline** — shows a guidance message when no chapters exist instead of rendering nothing
- [x] **Location sidebar search** — `SidebarSearch` input in `LocationsSection`; filters by name in real time; no DB changes
- [x] **Label density toggle** — `showLocationLabels` in `MapFilters`; "Labels" button in filter bar; `makeLocationIcon` renders dot-only when `showLabel=false`
- [x] **Full character journey trail** — `showJourneys` in `MapFilters`; "Journeys" button in filter bar; `useWorldSnapshots` + ordered event index → faded dashed `Polyline` per character on current layer
- [x] **Character path film strip** — `CharacterFilmStrip` component; appears at bottom of canvas when a character is selected; scrollable stop list (location + chapter); clicking a stop calls `setActiveEventId`
- [x] **Persistent routes** — `MapRoute` in DB v15; `useMapRoutes` hook; click-marker draw mode with `RouteDrawHud`; styled `Polyline` per route type; Routes sidebar section
- [x] **Region polygons** — `MapRegion` + `MapRegionSnapshot` in DB v15; `useMapRegions` hook; click-canvas draw mode with live preview + `RegionDrawHud`; `Polygon` with label tooltip; per-event status; Regions sidebar section
- [x] **Map export** — `html2canvas` dependency; Export button in map header; captures `.leaflet-container` as PNG download

---

## Planned Enhancements

### Location sidebar search
Filter input at the top of the Locations section in `MapSidebar`. Filters the rendered list in real time by `marker.name`. No DB changes — pure UI state.

**Files:** `src/features/maps/MapSidebar.tsx` (`LocationsSection`)

---

### Label density toggle
A toggle in the map header (or filter bar) to switch between full pill labels and dot-only mode. In dot mode, `makeLocationIcon` renders a simple coloured circle (no name/type text). Reduces clutter on large maps when zoomed out.

**Files:** `src/features/maps/MapFilterBar.tsx`, `src/features/maps/LeafletMapCanvas.tsx` (`makeLocationIcon`)

---

### Full character journey trail
A toggleable per-character overlay showing their complete path across *all* chapters. Reads every `CharacterSnapshot` for the character in chapter order, resolves each `currentLocationMarkerId` to coordinates, and draws a faded polyline through the sequence. Only markers on the current layer are included; markers on sub-maps are skipped or shown as a gap.

**Files:** `src/features/maps/MapExplorerView.tsx`, `src/features/maps/LeafletMapCanvas.tsx`  
**New hook:** `useCharacterFullJourney(characterId, worldId, layerId)` — returns ordered `{x, y}[]`  
**UI:** Toggle button per character in the Characters sidebar section; or a global "Show full journeys" toggle in the filter bar.

---

### Character path film strip
A horizontal timeline strip that appears at the bottom of the map canvas when a character pin is clicked (or a character is selected in the sidebar). Shows each chapter the character appears in as a labelled stop, with their location name and chapter number. Clicking a stop calls `setActiveEventId` to the last event of that chapter.

**Files:** `src/features/maps/MapExplorerView.tsx`, new `CharacterFilmStrip.tsx` component  
**Data:** Reads all `CharacterSnapshot` records for the character across all chapters, joined with chapter/event metadata.

---

### Persistent routes between locations
A new `MapRoute` entity stored in IndexedDB, independent of character movement:

```typescript
MapRoute {
  id, worldId, mapLayerId
  name: string
  routeType: 'road' | 'river' | 'border' | 'trail' | 'sea_route' | 'custom'
  waypoints: string[]   // ordered locationMarkerIds (or raw {x,y} points)
  color?: string
  notes?: string
  createdAt, updatedAt
}
```

Routes are rendered as styled polylines on the map — always visible, not chapter-scoped. A "Routes" section in the map sidebar lists them; clicking one selects it for editing. Route creation: a draw mode (similar to scale calibration) where the user clicks a sequence of markers.

**Route type speed multipliers** (applied by the continuity checker on top of the character's travel mode speed):

| Route type | Multiplier | Rationale |
|---|---|---|
| `road` | 1.25× | Maintained surface, faster than open land |
| `trail` | 1.0× | Baseline — same as open travel |
| `river` (downstream) | 1.5× | Boat travel with current |
| `river` (upstream) | 0.6× | Against current |
| `sea_route` | 1.4× | Open water sailing |
| `border` | 1.0× | Cosmetic only, no speed effect |
| `custom` | 1.0× | User-defined, no default effect |

The multipliers are constants in the continuity checker; route direction (for rivers) is inferred from waypoint order relative to a configurable "flow direction" flag on the route (deferred — default to 1.0× until implemented).

**DB:** New `mapRoutes` table in `src/db/database.ts` (new version block)  
**Files:** `src/db/hooks/useMapRoutes.ts`, `src/features/maps/LeafletMapCanvas.tsx`, `src/features/maps/MapSidebar.tsx`, `src/features/continuity/ContinuityChecker.tsx`

---

### Region polygon support
A new `MapRegion` entity for drawing filled polygons:

```typescript
MapRegion {
  id, worldId, mapLayerId
  name: string
  vertices: Array<{x: number; y: number}>   // polygon points in pixel coords
  fillColor: string
  opacity: number   // 0–1
  notes?: string
  createdAt, updatedAt
}
```

Rendered as Leaflet `Polygon` with a label at the centroid. A draw mode lets users click to place vertices, double-click to close. A "Regions" section in the sidebar lists them.

Status is tracked per chapter/event using a `MapRegionSnapshot` record (same pattern as `LocationSnapshot`):

```typescript
MapRegionSnapshot {
  id, worldId, regionId, eventId
  status: 'active' | 'occupied' | 'contested' | 'abandoned' | 'destroyed' | 'unknown'
  notes?: string
  updatedAt: number
}
```

The polygon fill color shifts to reflect status at the active event, same as location marker status badges.

**DB:** New `mapRegions` and `mapRegionSnapshots` tables  
**Files:** `src/db/hooks/useMapRegions.ts`, `src/db/hooks/useMapRegionSnapshots.ts`, `src/features/maps/LeafletMapCanvas.tsx`, `src/features/maps/MapSidebar.tsx`

---

### Map export as image
Export the current map view (markers, pins, movement lines visible) as a PNG. Leaflet renders to a canvas internally but the image overlay is cross-origin-tainted when loaded from IndexedDB blob URLs, which blocks `canvas.toDataURL()`. Workaround: use `html2canvas` on the map container div, or re-draw the composited image server-side. For a local-first Electron app, `html2canvas` is the pragmatic choice.

**Files:** `src/features/maps/MapExplorerView.tsx` (export button in map header)  
**Dependency:** `html2canvas`
