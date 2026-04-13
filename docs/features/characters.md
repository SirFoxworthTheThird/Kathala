# Feature: Characters

## Overview

The Characters feature provides a roster of every character in the world with full per-chapter snapshot tracking. State is recorded independently per event — location, alive/dead status, inventory, and notes — so any chapter can be loaded and the snapshot accurately reflects that moment in the story.

---

## What Already Works

- **Roster view** — `CharacterRosterView` lists all characters with portrait thumbnails, current location, and alive/dead status at the active event
- **Create / edit / delete** — `CreateCharacterDialog` + inline edit in `OverviewTab`; fields: name, aliases, role, description, tags, colour, portrait image upload
- **Per-character colour** — `color: string | null` field on `Character` type; used as a left-border tint in arc rows
- **Detail view tabs:**
  - `OverviewTab` — bio, role, description, tags, colour picker, portrait upload
  - `CurrentStateTab` — snapshot editor for the active event: alive/dead, location marker, inventory item picker, status notes, travel mode
  - `HistoryTab` — read-only chronological list of all snapshots across all events
  - `RelationshipsTab` — list of all relationships with sentiment, strength, and chapter-aware notes
- **Portrait images** — blobs stored in `blobs` table; `PortraitImage` component renders them everywhere (roster, map pins, relationship graph, timeline cards)
- **Snapshot inheritance** — `useBestSnapshots(worldId, activeEventId)` resolves the most recent snapshot at or before the active event; inherited state is shown across all views
- **Global search** — characters are searchable via the `SearchPalette` (`Ctrl+K`)

---

## User Stories

- As a writer, I want to bulk-tag characters so I can filter the roster by storyline or faction.
- As a writer, I want to see a character's full status notes history inline in the History tab without clicking into each snapshot.
- As a writer, I want to clone a character (copy all metadata, start fresh snapshots) so I can quickly set up similar characters.
- As a writer, I want to merge two duplicate characters, preserving all their snapshots under one record.

---

## Technical Approach

### Key files
- `src/features/characters/CharacterRosterView.tsx` — roster grid; reads `useBestSnapshots` to show live state (69 lines)
- `src/features/characters/CharacterDetailView.tsx` — four-tab detail view (105 lines)
- `src/features/characters/tabs/CurrentStateTab.tsx` — snapshot editor
- `src/features/characters/tabs/HistoryTab.tsx` — sorted snapshot list
- `src/features/characters/tabs/OverviewTab.tsx` — character metadata editor
- `src/features/characters/tabs/RelationshipsTab.tsx` — relationship list (reads from `useBestRelationshipSnapshots`)
- `src/db/hooks/useCharacters.ts` — `useCharacters(worldId)`, `useCharacter(id)`, `createCharacter`, `updateCharacter`, `deleteCharacter`
- `src/db/hooks/useSnapshots.ts` — `useBestSnapshots(worldId, eventId)`, `upsertCharacterSnapshot`
- `src/types/character.ts` — `Character`, `CharacterSnapshot`

### Snapshot resolution
`useBestSnapshots` loads all `CharacterSnapshot` records for the world and resolves the best snapshot per character: the most recent record where `sortKey <= activeSortKey`. `sortKey = chapter.number * 10_000 + event.sortOrder`.

### Image storage
Portraits are stored as `Blob` entries in the `blobs` table keyed by `portraitImageId`. `useWorldBlobUrls(worldId)` builds a `Map<id, objectURL>` used throughout the app; the map is memoised to avoid re-renders.

---

## Tasks

- [x] Character roster with portrait and chapter-aware location/status
- [x] Four-tab detail view (Overview, Current State, History, Relationships)
- [x] Portrait image upload and display throughout the app
- [x] Per-character colour field + arc row tinting
- [x] `useBestSnapshots` snapshot resolution with memoised reference stability
- [x] Travel mode per snapshot
- [x] Global search integration
