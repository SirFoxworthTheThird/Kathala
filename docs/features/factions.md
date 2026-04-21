# Feature: Factions

## Overview

Named groups that characters belong to, with membership tracked per event using the existing snapshot model. Allegiances change over time — a character who joins the rebellion in Chapter 4 was loyal to the crown before it. Factions integrate with the relationship graph (intra-faction / cross-faction edges styled differently), the map (regions owned by a faction), the continuity checker (allegiance-based conflict detection), and the Arc View (faction colour as an optional cell overlay).

---

## Data Model

```ts
interface Faction {
  id: string
  worldId: string
  name: string
  description: string
  color: string               // hex — used across all views
  coverImageId: string | null
  tags: string[]
  createdAt: number
  updatedAt: number
}

interface FactionMembership {
  id: string
  worldId: string
  factionId: string
  characterId: string
  role: string | null         // e.g. "leader", "spy", "conscript"
  startEventId: string | null // null = from the beginning of the world
  endEventId: string | null   // null = still active at latest event
  notes: string
  createdAt: number
  updatedAt: number
}
```

New DB tables: `factions` (v19 or v20), `factionMemberships` (same version).

`MapRegion` gains an optional `factionId: string | null` field (backfill migration) — the owning faction at any given event, used for map colouring and continuity checks.

---

## UI

### Factions panel / page
A **Factions** section accessible from the World Dashboard or as a tab within the Relationships view. Lists all factions with their colour swatch, member count, and description.

- **Add faction** dialog: name, colour picker, description.
- **Faction detail panel** (slide-in or full page): name/description/colour edit, member roster, linked map regions.

### Membership management
- On the **Character detail view** (Overview tab or a new "Factions" tab): a list of that character's faction memberships across time. Each row shows faction name + colour swatch, role, start/end events, and notes. "Add membership" button opens a picker.
- On the **Faction detail panel**: the full member roster with the same fields. Clicking a member navigates to their character.
- Membership is event-scoped: `startEventId` and `endEventId` gate when membership is shown. At any event, a character's *active* memberships are those where `startEventId ≤ activeEvent` and (`endEventId` is null or `endEventId > activeEvent`).

### Relationship graph integration
- Faction nodes rendered as a faint coloured cluster background behind member character nodes (optional, toggleable).
- Edges between characters in the *same* faction rendered with a subtle faction-colour tint.
- Edges between characters in *opposing* factions (negative-sentiment relationships) rendered with a cross-faction marker.

### Map integration
- Region polygons can be assigned a faction via the Region Detail Panel. The region fill colour optionally reflects the owning faction's colour.
- During playback, if a region's faction changes between events, the fill colour animates to the new faction colour.

### Arc View integration
- Optional **faction overlay** mode: cells show a thin coloured border or background tint for the character's active faction at that event. Toggled via the filter bar.

### Continuity checker integration
New check: **faction conflict** — flag when a character is simultaneously marked as having a positive-trust relationship with a character from a directly opposing faction (where both factions have a defined adversarial link). Requires a separate `FactionRelationship` table (or a simple "rival faction" field on Faction) to define which factions oppose each other.

---

## Export
- `.pwk` export includes factions and memberships.
- HTML export gains a **Factions** section listing each faction with its description, colour, and member roster.

---

## User Stories

- As a writer, I want to define factions (House Stark, The Thieves' Guild) so I can track which side each character is on at any point in the story.
- As a writer, I want to record when a character switches allegiances so the app can flag continuity issues if they act against their stated faction.
- As a writer, I want faction ownership shown on map regions so I can visualise territorial control at any event.
- As a writer, I want the relationship graph to visually group characters by faction so I can see intra-faction networks at a glance.
- As a writer, I want faction memberships included in the HTML export so collaborators can see the political landscape alongside the timeline.
