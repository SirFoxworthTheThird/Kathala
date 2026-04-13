# Feature: Search

## Overview

The global search palette (`SearchPalette`) provides instant full-text search across every entity type in the active world. It is opened via `Ctrl+K` / `⌘K` from anywhere in the app, results are grouped by type, and keyboard navigation jumps directly to the matched entity.

---

## What Already Works

- **Keyboard shortcut** — `Ctrl+K` (Windows/Linux) or `⌘K` (macOS) opens the palette; `Esc` closes it
- **Entity types searched** — characters, items, location markers, chapters, events, timelines, relationships (all 7 types)
- **Live queries** — each entity type uses `useLiveQuery` so results update instantly as data changes
- **Full-text match** — `highlight()` helper does case-insensitive substring match; matching text is highlighted inline in results
- **Grouped display** — results grouped by type in a fixed order: character → item → location → chapter → event → timeline → relationship; each group has a colour-coded icon
- **Keyboard navigation** — `↑`/`↓` moves between results; `Enter` navigates to the selected result; active item scrolls into view
- **Navigation on select** — `go(result)` calls `setActiveEventId` where applicable, then uses React Router `navigate` to jump to the entity's detail view
- **Empty state** — "No results" message shown when query matches nothing
- **Zustand integration** — `searchOpen` / `setSearchOpen` in store; palette renders conditionally in `AppShell`

---

## User Stories

- As a writer, I want to search across multiple worlds at once so I can find a concept I used in a previous project.
- As a writer, I want recent searches saved so I can quickly return to frequently-accessed entities.
- As a writer, I want to filter results to a single entity type by pressing a hotkey (e.g. `#` for chapters, `@` for characters).
- As a writer, I want fuzzy matching so a typo doesn't return zero results.

---

## Technical Approach

### Key files
- `src/features/search/SearchPalette.tsx` — full implementation (247 lines)
- `src/store/index.ts` — `searchOpen`, `setSearchOpen` flags
- `src/components/AppShell.tsx` — renders `<SearchPalette />` and sets up `Ctrl+K` listener

### Result type
```typescript
type ResultType = 'character' | 'item' | 'location' | 'chapter' | 'event' | 'timeline' | 'relationship'
type SearchResult = { type: ResultType; id: string; label: string; sublabel?: string }
```

### Matching
Current matching is simple substring — `text.toLowerCase().includes(query.toLowerCase())`. For each entity, both `name`/`title` and secondary fields (description, aliases, synopsis) are searched.

### Navigation targets
| Type | Navigation |
|---|---|
| character | `/worlds/:id/characters/:charId` |
| item | `/worlds/:id/items/:itemId` |
| location | `/worlds/:id/maps` (sets active marker) |
| chapter | `/worlds/:id/timeline/:chapterId` |
| event | sets `activeEventId`, navigates to `/worlds/:id/timeline/:chapterId` |
| timeline | `/worlds/:id/timeline` |
| relationship | `/worlds/:id/relationships` |

---

## Tasks

- [x] Palette opens on `Ctrl+K` / `⌘K`, closes on `Esc`
- [x] Live queries across all 7 entity types
- [x] Inline text highlighting
- [x] Grouped results with colour-coded icons
- [x] Keyboard navigation (↑↓ + Enter) with scroll-into-view
- [x] `setActiveEventId` called on event/chapter navigation
- [x] Empty state
