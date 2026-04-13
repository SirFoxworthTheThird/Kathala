# Feature: Relationships

## Overview

The Relationships feature provides a visual ReactFlow network graph of all character connections in the world. Relationships are event-scoped — they only appear from their `startEventId` onwards — and can have per-event snapshot overrides for sentiment, strength, and notes. Edges from inherited snapshots are visually distinguished from current-chapter overrides.

---

## What Already Works

- **ReactFlow graph** — `RelationshipGraphView` renders character nodes with portraits and relationship edges
- **Custom node** — portrait image (or initials fallback) with character name label
- **Custom edge** — straight path; colour driven by sentiment (`positive` = green, `neutral` = grey, `negative` = red, `complex` = amber); inherited edges shown as dashed lines
- **Relationship fields** — label, sentiment, strength (weak/moderate/strong/bond), bidirectional flag, description
- **Event scoping** — `startEventId` on each relationship; edges hidden before that event in the graph; `globalOrder` comparison used for filtering
- **Per-event snapshot editor** — `SnapshotEditor` component in the sidebar: override sentiment, strength, label, description for the active event; or end the relationship (mark inactive)
- **Inherited state indicator** — when the displayed snapshot is not from the active event, a note shows which earlier event it's inherited from; edge rendered dashed
- **Node positions** — persisted in `localStorage` per world (`wb-rel-pos-${worldId}`); survive navigation and app restart
- **Add / delete relationship** — dialog to pick two characters, set label/sentiment/strength/start event
- **Continuity check integration** — `ContinuityChecker` warns when a snapshot precedes `startEventId`

---

## User Stories

- As a writer, I want to filter the graph to show only relationships involving a specific character so I can focus on their network.
- As a writer, I want to group characters into clusters (faction, location) so the graph stays readable for large casts.
- As a writer, I want a timeline slider directly on the graph so I can scrub through how the network evolved without leaving the view.
- As a writer, I want to export the relationship graph as an image for use in planning documents.

---

## Technical Approach

### Key files
- `src/features/relationships/RelationshipGraphView.tsx` — full implementation (428 lines); ReactFlow canvas + snapshot editor sidebar
- `src/db/hooks/useRelationships.ts` — `useRelationships(worldId)`, `createRelationship`, `updateRelationship`, `deleteRelationship`
- `src/db/hooks/useSnapshots.ts` — `useBestRelationshipSnapshots(worldId, eventId)`, `upsertRelationshipSnapshot`
- `src/types/relationship.ts` — `Relationship`, `RelationshipSnapshot`, `RelationshipSentiment`, `RelationshipStrength`

### Edge visibility logic
```typescript
// edges filtered in useMemo inside RelationshipGraphView
const startOrder = globalOrder(r.startEventId)
if (activeOrder !== null && startOrder > activeOrder) return []  // not yet visible
const snap = snapshotMap.get(r.id)
const isActive = snap?.isActive ?? true
if (!isActive) return []  // ended
```

### Snapshot inheritance
`useBestRelationshipSnapshots` resolves the most recent snapshot per relationship at or before `activeEventId`. If no override exists, the relationship renders with its base fields (label, sentiment, strength from the `Relationship` record itself). `isSnapInherited` is true when `snapshot.eventId !== activeEventId`.

### Position persistence
Node positions are written to `localStorage` on every `onNodesChange` call (debounced by React's batching). They are read once at component mount via `useState` initialiser — no Zustand or IndexedDB involved.

---

## Open Questions

- Should node positions be stored in IndexedDB per world (survives device transfer via `.pwk`) rather than localStorage?
- Should `startEventId` be changeable after creation, or locked once set to avoid accidental continuity breaks?

---

## Tasks

- [x] ReactFlow graph with custom character nodes and relationship edges
- [x] Sentiment colour coding and dashed-edge inherited state indicator
- [x] Event-scoped visibility via `startEventId` + `globalOrder` comparison
- [x] Per-event snapshot editor (override sentiment, strength, notes, active/inactive)
- [x] Node position persistence in localStorage
- [x] Add/delete relationship dialog
- [x] Continuity checker integration (early-snapshot warning)
