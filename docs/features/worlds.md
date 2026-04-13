# Feature: Worlds

## Overview

Worlds are the top-level container in PlotWeave. Each world is completely self-contained — its own characters, maps, timelines, items, relationships, travel modes, and settings. The world selector screen is the app's home page; the dashboard provides a per-world overview and settings.

---

## What Already Works

- **World selector** (`WorldSelectorView`) — lists all worlds as cards with name, description, and entity counts; create, import, and delete actions
- **World card** (`WorldCard`) — shows name, description, character count, map count, and timeline count; export and delete buttons
- **Create world** — `CreateWorldDialog`; fields: name, description
- **World dashboard** (`WorldDashboardView`) — per-world overview showing entity counts (characters, maps, timelines, relationships) as stat tiles; quick-navigate tiles to each section
- **Travel modes** — per-world travel mode list on the dashboard; create/edit/delete modes (name, speed per day); used by the continuity checker for travel-distance validation
- **Scale unit inference** — dashboard infers the world's distance unit from the first map layer that has `scaleUnit` set
- **Export / Import** — export any world to `.pwk` from the world card; import `.pwk` from the selector screen (see [export-import.md](export-import.md))
- **Multi-world support** — worlds share no data; `worldId` is a foreign key on every entity

---

## User Stories

- As a writer, I want to duplicate a world so I can experiment with an alternate timeline without losing my original.
- As a writer, I want to set a cover image for my world so the selector screen is visually distinct.
- As a writer, I want to archive a world (hide it from the selector without deleting it) so my workspace stays clean.
- As a writer, I want to rename a world without re-entering the full creation dialog.

---

## Technical Approach

### Key files
- `src/features/worlds/WorldSelectorView.tsx` — home screen; lists all worlds
- `src/features/worlds/WorldDashboardView.tsx` — dashboard with stat tiles + travel mode management (189 lines)
- `src/features/worlds/WorldCard.tsx` — world card component
- `src/features/worlds/CreateWorldDialog.tsx` — new world dialog
- `src/db/hooks/useWorlds.ts` — `useWorlds`, `useWorld`, `createWorld`, `updateWorld`, `deleteWorld`
- `src/db/hooks/useTravelModes.ts` — `useTravelModes`, `createTravelMode`, `updateTravelMode`, `deleteTravelMode`
- `src/store/index.ts` — `activeWorldId` (persisted in localStorage)
- `src/types/world.ts` — `World`, `TravelMode`

### World isolation
Every entity table has a `worldId` index. All hooks accept `worldId` as the first parameter and scope queries with `db.table.where('worldId').equals(worldId)`. Deleting a world cascades: `deleteWorld` removes all associated records across all tables.

### Travel modes
`TravelMode` records (`id, worldId, name, speedPerDay`) are created and managed on the dashboard. `speedPerDay` + a map layer's `scalePixelsPerUnit` + `scaleUnit` are used by `ContinuityChecker` to compute whether a character could travel between two markers in the given number of `travelDays` on the event.

---

## Tasks

- [x] World selector with create / import / delete
- [x] World dashboard with entity count tiles and quick-navigate
- [x] Travel mode management (CRUD per world)
- [x] World-scoped entity isolation via `worldId` foreign key
- [x] `activeWorldId` persisted in Zustand (localStorage)
- [x] Export / import integration on world card
