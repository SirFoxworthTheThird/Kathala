# Feature: Empty States & Onboarding

## Overview

Empty states are the first thing a new user sees in every section. Currently they're inconsistent — some use the shared `EmptyState` component, many use inline text, and most lack contextual guidance. Fixing this makes the app feel more polished and helps new users understand what to do next.

---

## What Already Works

A reusable `EmptyState` component exists at `src/components/EmptyState.tsx`:

```typescript
interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}
```

It renders a centred column with icon in a muted rounded background, a title, optional description, and optional action node.

**Currently using EmptyState correctly:**
- `TimelineView` — "No timeline yet" / "No chapters yet" (with action buttons)
- `CharacterRosterView` — "No characters yet" / "No matches" (distinguishes zero-data vs. filtered)
- `ItemRosterView` — "No items yet" / "No matches"
- `RelationshipGraphView` — "No characters yet"
- `CharacterArcView` — "Nothing to show"
- `WorldSelectorView` — "No worlds yet"

**Using inline text instead (should be migrated):**
- `ChapterRow` — "No events yet." (text-xs italic, no icon, no action)
- `ChapterDetailView` — "No events yet." (no action)
- `ChapterDetailView` — "No relationship states recorded."
- `WritersBriefPanel` — "No events recorded." / "No character states recorded."
- `CharacterCard` — "No snapshot for selected chapter"
- `HistoryTab` — "No snapshots recorded yet."
- `RelationshipsTab` — "No relationships yet." / "No relationships at this point in the story yet."
- `MapExplorerView` — "No characters yet." / "No locations on this map." / "No maps yet."
- `CharacterSnapshotPanel` — "Select a chapter to record character state."
- `LocationDetailPanel` — "No event selected" prompt

---

## User Stories

- As a new user, I want each empty section to tell me exactly what to do next so I don't have to guess.
- As a new user, I want empty states to be visually distinct from content so I know a section is empty rather than broken.
- As a writer, I want empty states that are aware of context — e.g. if I have characters but no snapshots, tell me to select an event, not to create characters.

---

## Technical Approach

### Consistency pass
Replace all inline empty state text with the `EmptyState` component. This is mostly mechanical — pick an appropriate Lucide icon for each context and add an action node where a clear next step exists.

**Suggested icons by context:**

| Context | Icon | Action |
|---------|------|--------|
| No events in chapter | `Scroll` | "Add Event" button |
| No snapshots for character | `Camera` | "Select an event above" (no button) |
| No relationship states | `Network` | none (states are auto-created) |
| No maps | `Map` | "Upload Map" button |
| No locations on map | `MapPin` | "Right-click the map to add a location" |
| No characters on map | `Users` | Link to characters section |
| No travel modes | `Navigation` | "Add Travel Mode" button |
| No items in inventory | `Package` | none |

### Context-aware messaging
`CharacterArcView` currently shows "Add characters and chapters" even if both exist but have no snapshots. Make the message smarter:

```tsx
const message =
  characters.length === 0 ? 'Add characters to get started.' :
  chapters.length === 0   ? 'Add chapters to your timeline to see the arc.' :
                            'No snapshots recorded yet. Select an event to start tracking character states.'
```

Apply the same pattern to `WritersBriefPanel`, `HistoryTab`, and `RelationshipsTab`.

### Zero-data vs. filtered-to-zero
`CharacterRosterView` already handles this correctly. Apply the same pattern to:
- `MapExplorerView` character list (has a search filter)
- `MapExplorerView` location list (has a search filter)
- Any future list with a search box

Pattern:
```tsx
const empty = items.length === 0
const filtered = !empty && filtered_items.length === 0
// render EmptyState with different message for each case
```

### Inline "no event selected" prompts
`CharacterSnapshotPanel` and `LocationDetailPanel` show freeform prompts when no event is active. These should be replaced with `EmptyState` using a `Clock` or `MousePointer` icon and copy like "Select an event in the timeline to view state here."

---

## Open Questions

- Should empty state action buttons open dialogs (current approach) or navigate to a different section? Opening dialogs is more immediate; navigation breaks the user's context less. Keep dialog approach for items within the same section.
- How much should empty states differ between "brand new world" (zero data anywhere) vs. "this section is empty but others have data"? The context-aware messaging section above handles the most important cases; full onboarding flow is out of scope here.

---

## Tasks

- [ ] **`ChapterRow` / `ChapterDetailView`** — replace "No events yet." with `EmptyState` (icon: `Scroll`, action: "Add Event")
- [ ] **`WritersBriefPanel`** — replace inline empty strings with `EmptyState` (context-aware: no chapters vs. no snapshots)
- [ ] **`HistoryTab`** — replace inline text with `EmptyState`; context-aware message
- [ ] **`RelationshipsTab`** — replace inline text with `EmptyState`; distinguish no-relationships vs. none-at-this-point
- [ ] **`MapExplorerView`** — replace all inline empties with `EmptyState`; add zero-data vs. filtered distinction for search
- [ ] **`CharacterSnapshotPanel` / `LocationDetailPanel`** — replace freeform prompts with `EmptyState` using pointer/clock icon
- [ ] **`CharacterArcView`** — make empty message context-aware (no characters / no chapters / no snapshots)
- [ ] **Audit pass** — grep for remaining inline italic empty text after above changes and migrate any stragglers
