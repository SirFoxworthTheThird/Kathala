# Feature: Items

## Overview

The Items feature provides a world-level catalogue of props, artefacts, weapons, and key objects. Each item can be placed in a character's inventory or at a map location per event, and carries its own per-event snapshot (condition, notes). Moving an item automatically removes it from its previous owner/location.

---

## What Already Works

- **Item catalogue** — `ItemRosterView` lists all items for the world with image thumbnails, name, description, and icon type
- **Create / edit / delete** — `CreateItemDialog` and `ItemDetailView`; fields: name, description, icon type (weapon, artefact, book, container, tool, key, misc), image upload
- **Item images** — stored as blobs; shown in the roster, character inventory panels, location detail panels, map sidebar, and timeline snapshot cards
- **Per-event inventory** — items added to `CharacterSnapshot.inventoryItemIds`; resolved via `useBestSnapshots`
- **Per-event placement** — `ItemPlacement` records (`itemId × eventId × locationMarkerId`); items appear in location detail panels on the map
- **Exclusive placement** — placing an item at a location or in an inventory removes any prior placement for that item at the same event
- **Per-event item snapshot** — `ItemSnapshot` records carry `condition` (intact/damaged/destroyed/lost/unknown) and `notes` per event
- **Continuity check** — `ContinuityChecker` flags duplicate ownership (item in multiple inventories/locations in the same event)

---

## User Stories

- As a writer, I want to see a full history of where an item has been across all chapters so I can track its journey.
- As a writer, I want to mark an item as "destroyed" and have it automatically removed from all future chapter inventories.
- As a writer, I want to filter the item roster by type (weapons, artefacts, etc.) so I can quickly find what I'm looking for.
- As a writer, I want to attach items to a world event's `involvedItemIds` so the continuity checker can detect when characters use items they don't yet have.

---

## Technical Approach

### Key files
- `src/features/items/ItemRosterView.tsx` — catalogue grid (71 lines)
- `src/features/items/ItemDetailView.tsx` — item metadata editor
- `src/features/items/ItemCard.tsx` — card used in roster and sidebars
- `src/db/hooks/useItems.ts` — `useItems(worldId)`, `useItem(id)`, `createItem`, `updateItem`, `deleteItem`
- `src/db/hooks/useSnapshots.ts` — `upsertItemPlacement`, `upsertItemSnapshot`, `useBestItemSnapshots`
- `src/types/item.ts` — `WorldItem`, `ItemSnapshot`, `ItemPlacement`

### Exclusive placement
When a user adds an item to a character's inventory or a map location, the write path checks for any existing `ItemPlacement` for that `(itemId, eventId)` pair and deletes it before creating the new one. The same applies to `inventoryItemIds` in `CharacterSnapshot`.

### Image storage
Same blob pattern as characters — `item.imageId` → `blobs` table → `useWorldBlobUrls`.

---

## Tasks

- [x] Item catalogue with image upload
- [x] Per-event inventory (character snapshot `inventoryItemIds`)
- [x] Per-event map placement (`ItemPlacement`)
- [x] Exclusive placement enforcement
- [x] Per-event item snapshot (condition, notes)
- [x] Display in roster, map sidebar, character panels, timeline cards
- [x] Continuity checker duplicate-ownership integration
