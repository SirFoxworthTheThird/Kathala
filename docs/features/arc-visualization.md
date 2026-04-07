# Feature: Arc Visualization

## Overview

The arc view gives a bird's-eye view of every character's journey across the story — where they are, whether they're alive, and what's happening to them at each point. It currently works as a scrollable table (characters × chapters or events). The goal is to make it richer without losing its readability.

---

## What Already Works

- Table layout: characters as rows, chapters or events as columns
- Toggle between Chapter view (one column per chapter, using last event's snapshot) and Event view (one column per event)
- Alive/dead icons (Heart / Skull) with row opacity reduction for dead characters
- Location name per cell (MapPin + name)
- Status notes as italic subtext with tooltip for overflow
- Active event column highlighted
- Click column header to jump the active event cursor to that chapter/event
- Sticky character name column + sticky header row
- Legend at bottom

---

## User Stories

- As a writer, I want to color-code characters' rows (or cells) so I can visually separate protagonists, antagonists, and side characters at a glance.
- As a writer, I want to see a character's inventory count trend so I can spot when they gain/lose items across the arc.
- As a writer, I want to compare two characters side-by-side in the arc view to spot when their paths cross or diverge.
- As a writer, I want to export the arc view as an image so I can include it in my planning documents.
- As a writer, I want to expand a cell to read the full status notes without needing to hover.
- As a writer, I want to filter the arc to show only specific characters so I can focus on a subplot.

---

## Technical Approach

### Key files
- `src/features/arc/CharacterArcView.tsx` — entire implementation (298 lines); self-contained
- `src/types/character.ts` — `Character` (has no color field), `CharacterSnapshot`

### Per-character color
Add an optional `color: string | null` field to the `Character` type and a Dexie migration. In `CharacterArcView`, use `character.color` (or a generated hue from the character's id as fallback) to tint the row's left border or the name badge. A small color swatch button in the character edit form opens a color picker.

### Inventory count sparkline
`CharacterSnapshot.inventoryItemIds` is already an array. Per character, collect `inventoryItemIds.length` across all events in order → render a tiny inline bar chart (pure CSS or a micro SVG, no charting library needed) in the character name cell. This is read-only, computed from live data.

### Cell expand
Currently `statusNotes` is `line-clamp-2`. Replace with a click-to-expand pattern: clicking a cell toggles a `expandedCellKey` state (`${characterId}:${eventId}`), showing the full notes in an absolutely positioned tooltip/popover.

### Character filter
Add a search input above the table that filters `displayedCharacters` by name. Simple `useState` + `.filter()` — no DB query needed since all characters are already loaded.

### Export to image
Use the `html2canvas` library (or `dom-to-image`) on the arc table container. Add an export button in the header. Since the table can be wide, capture the full scroll width by temporarily expanding the container before capture.

### Side-by-side comparison
A "Compare" mode toggle: user picks two characters via dropdowns, then the table collapses to just those two rows with a larger cell height to show full status notes. Low priority — nice to have.

---

## Open Questions

- Should character color be stored on the `Character` record (permanent), or only as a local UI preference? Storing on `Character` is simpler and survives export/import.
- For the inventory sparkline: should it show absolute count or relative change (+2, -1)? Absolute count is more scannable.
- Export: should it export the visible viewport only, or the full arc? Full arc is more useful but harder to implement correctly with Leaflet-style virtual scroll.

---

## Tasks

- [x] **Per-character color** — `color: string | null` on `Character` type + Dexie v12 migration; left-border tint in arc rows; native color picker + clear button in OverviewTab edit form
- [x] **Inventory sparkline** — item count per event per character; inline SVG polyline in name cell
- [x] **Cell expand on click** — click any cell with status notes to toggle expand/collapse; truncated by default
- [x] **Character filter** — search input in arc header; filters rows by name; shows match count; clear button
- [x] **Export to image** — "PNG" button using `html2canvas` (scale×2); captures full scroll width of arc table
- [ ] **Side-by-side comparison mode** — two-character focused view with full status notes visible (low priority)
