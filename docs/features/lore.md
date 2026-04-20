# Feature: Lore

## Overview

A wiki-like system for world-building information that isn't time-varying and doesn't belong in the snapshot model: magic systems, religions, factions (light-weight), cultural details, in-world history, geography descriptions, bestiary entries, terminology, etc.

Lore pages are free-form rich-text documents organised into user-defined categories. They live alongside the snapshot-driven data but are purely informational — no event scoping, no inheritance, no state changes. Writers reference them while writing; the app surfaces them in search and (optionally) links them from characters, locations, and items.

---

## Data Model

```ts
interface LorePage {
  id: string
  worldId: string
  categoryId: string | null   // null = uncategorised
  title: string
  body: string                // markdown or plain text
  tags: string[]
  coverImageId: string | null
  createdAt: number
  updatedAt: number
}

interface LoreCategory {
  id: string
  worldId: string
  name: string
  color: string | null        // optional accent colour
  sortOrder: number
}
```

New DB tables: `lorePages` (v19), `loreCategories` (v19).

---

## UI

### Lore nav item
A new **Lore** entry in the TopBar nav (between Items and Relations, or after Settings). Uses a `BookMarked` or `ScrollText` icon.

### Lore index view (`/worlds/:worldId/lore`)
- Left panel: category list with collapse/expand. "Uncategorised" at the bottom.
- Right panel: page list for the selected category, sorted by `updatedAt` desc.
- "New page" button per category; "New category" button at the top.
- Each page row shows title, first line of body as a subtitle, tags, and last-updated date.
- Search input at the top filters across all categories by title and body text.

### Lore page editor (`/worlds/:worldId/lore/:pageId`)
- Title field (large, inline edit).
- Body: a simple **markdown editor** with a live preview toggle. Supports headings, bold, italic, lists, blockquotes, horizontal rules, and inline code — no need for tables or complex syntax.
- Tags: same chip-input pattern as characters and items.
- Cover image: optional, same blob-upload pattern as character portraits.
- Category picker in the sidebar.
- Delete button with confirmation dialog.

### Linking from other entities
- On `LocationMarker`, `Character`, and `Item` detail views: an optional **"Lore"** chip/badge in the sidebar that links to one or more lore pages. Stored as a `linkedLorePageIds: string[]` field on those entities (DB backfill migration).
- Reverse: the lore page editor shows a "Referenced by" list of characters/locations/items that link to it.

---

## Search integration
`SearchPalette` gains a **Lore** result type (BookMarked icon). Searching finds pages by title and body content. Selecting a result navigates to the page editor.

---

## Export
- `.pwk` export includes all lore pages and categories.
- HTML export gains a **Lore** section listing all pages grouped by category.

---

## User Stories

- As a writer, I want a place to document my magic system rules so I can reference them without leaving the app.
- As a writer, I want to link a location marker to its lore page so I can jump from the map directly to the world-building notes for that place.
- As a writer, I want to search my lore pages by keyword so I can quickly find the entry about a specific faction or concept.
- As a writer, I want to organise lore into categories (Magic, History, Factions, Creatures…) so the wiki stays navigable as it grows.
- As a writer, I want lore pages included in the HTML export so collaborators can read the world-building context alongside the story timeline.
