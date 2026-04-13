# Feature: Export / Import

## Overview

The `.pwk` (PlotWeave world kit) format lets users back up a world to a single JSON file and restore it on any device. All entity data and images are included; the file is fully self-contained. The current format version is **v3**.

---

## What Already Works

- **Export** — `exportWorld(worldId)` in `src/lib/exportImport.ts`; collects all entity tables for the world, reads all blob records, base64-encodes blobs, and serialises to JSON; triggers browser file download via `<a download>`
- **Import** — `importWorld(file)` reads a `.pwk` file, calls `normalizeImport` to upgrade older format versions, then bulk-inserts all records into IndexedDB
- **Full fidelity** — includes: world, characters, characterSnapshots, items, itemSnapshots, itemPlacements, mapLayers, locationMarkers, locationSnapshots, timelines, chapters, events, characterMovements, relationships, relationshipSnapshots, travelModes, blobs, and relationship graph positions (`_relPositions`)
- **Backward compatibility** (`normalizeImport`):
  - v1 → v2: adds `startChapterId`, `scalePixelsPerUnit`, `scaleUnit`, `synopsis`, `notes` defaults
  - v2 → v3: calls `backfillSortKeys` — computes and writes `sortKey` on all four snapshot tables from chapter number + event sortOrder
- **Import creates a new world** — never overwrites; all IDs are preserved from the file
- **Version guard** — import rejects files with `version < 1` or `version > EXPORT_VERSION`

---

## User Stories

- As a writer, I want to export only specific chapters so I can share a portion of my world without revealing spoilers.
- As a writer, I want to merge an imported world into an existing one so I can combine two projects.
- As a writer, I want a diff of what changed since my last export so I can see whether a new backup is needed.

---

## Technical Approach

### Key files
- `src/lib/exportImport.ts` — `exportWorld`, `importWorld`, `normalizeImport`, `backfillSortKeys` (full implementation)
- `src/features/worlds/WorldCard.tsx` — export button; calls `exportWorld`
- `src/features/worlds/WorldSelectorView.tsx` — import file input; calls `importWorld`

### File format
```json
{
  "version": 3,
  "exportedAt": "ISO timestamp",
  "world": { ... },
  "characters": [ ... ],
  "characterSnapshots": [ ... ],
  "items": [ ... ],
  "itemSnapshots": [ ... ],
  "itemPlacements": [ ... ],
  "mapLayers": [ ... ],
  "locationMarkers": [ ... ],
  "locationSnapshots": [ ... ],
  "timelines": [ ... ],
  "chapters": [ ... ],
  "events": [ ... ],
  "characterMovements": [ ... ],
  "relationships": [ ... ],
  "relationshipSnapshots": [ ... ],
  "travelModes": [ ... ],
  "blobs": [ { "id": "...", "data": "<base64>", "mimeType": "image/png" } ],
  "_relPositions": { "<worldId>": { "<charId>": { "x": 0, "y": 0 } } }
}
```

### `backfillSortKeys`
For v1/v2 files that have no `sortKey` on snapshots:
```typescript
// Build chapter.number and event.sortOrder maps from imported data
// For each snapshot, find its event → find the event's chapter
// sortKey = chapter.number * 10_000 + event.sortOrder
// Write sortKey back onto the snapshot record before insert
```

### Blob encoding
Each blob is stored as `{ id, data: base64String, mimeType }` in the `blobs` array. On import, they are decoded back to `Blob` objects and inserted into the `blobs` table. Object URLs are not stored — they are generated at runtime by `useWorldBlobUrls`.

---

## Open Questions

- Should export support partial export (selected timelines or chapters)? Currently all-or-nothing.
- Should the `_relPositions` key be stored in a proper `relPositions` table rather than a JSON property?

---

## Tasks

- [x] Full world export to `.pwk` (v3) with all entities and base64 blobs
- [x] Import with new-world creation and ID preservation
- [x] `normalizeImport` v1 → v2 field defaults
- [x] `backfillSortKeys` v2 → v3 sortKey computation
- [x] Version range guard on import
- [x] Relationship graph positions in `_relPositions`
