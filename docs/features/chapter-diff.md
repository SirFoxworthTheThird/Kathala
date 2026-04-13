# Feature: Chapter Diff

## Overview

The Chapter Diff modal lets the user compare any two chapters side by side and see exactly what changed between them — which characters moved, which relationships changed sentiment or became inactive, and which items relocated. It is opened from the chapter timeline bar whenever a chapter is active.

---

## What Already Works

- **Trigger** — compare icon appears in `ChapterTimelineBar` when a chapter is active; clicking sets `diffOpen: true` in the Zustand store
- **Chapter selector** — two chapter pickers; left side pre-set to the active chapter, right side defaults to the preceding chapter; either side can be changed to any chapter in the world
- **Diff is based on last event** — for each chapter, `lastEventByChapter` maps the chapter to its last event (by `sortOrder`); snapshots are loaded at that event ID for both sides
- **Character diffs** — for every character with a snapshot on either side: shows location change, alive/dead change; `DiffTag` component labels each field as `same`, `changed`, `added`, or `removed`
- **Relationship diffs** — sentiment, strength, and active/inactive changes; both characters' names shown; inherited-vs-explicit note
- **Item diffs** — items that moved between inventories or locations; shows previous and current holder/location
- **`DiffTag` component** — pill badge with colour coding: green = added, red = removed, yellow = changed, grey = same
- **`SectionHeader` component** — icon + title + count of changed entries

---

## User Stories

- As a writer, I want to diff two non-consecutive chapters (e.g. chapter 1 vs chapter 22) to see the full arc of changes at a glance.
- As a writer, I want to see new-appearance characters (present in chapter B but not A) highlighted separately from characters who moved.
- As a writer, I want to export the diff as text so I can paste it into my notes.
- As a writer, I want keyboard shortcuts to quickly swap which chapters are being compared.

---

## Technical Approach

### Key files
- `src/features/diff/ChapterDiffModal.tsx` — full implementation (367 lines)
- `src/store/index.ts` — `diffOpen`, `setDiffOpen`
- `src/components/ChapterTimelineBar.tsx` — renders compare icon + sets `diffOpen`

### Snapshot loading
```typescript
// Each side loaded with useLiveQuery against CharacterSnapshot table
const snapsA = useLiveQuery(() => eventIdA ? db.characterSnapshots.where('eventId').equals(eventIdA).toArray() : [], [eventIdA])
const snapsB = useLiveQuery(() => eventIdB ? db.characterSnapshots.where('eventId').equals(eventIdB).toArray() : [], [eventIdB])
```

Both sides use direct event-ID lookups against the last event of each chosen chapter — not `useBestSnapshots`. This means the diff shows only explicitly recorded state, not inherited state, which is the correct behaviour for comparing what was actually recorded at each chapter.

### Diff logic
```typescript
const allCharIds = new Set([...snapAById.keys(), ...snapBById.keys()])
// For each character: compare location, isAlive between the two snapshots
// tag = 'same' | 'changed' | 'added' | 'removed'
```

---

## Open Questions

- Should the diff use `useBestSnapshots` (inherited state) or direct event lookup? Direct lookup was chosen — it shows what was explicitly recorded per chapter, not inherited forward state.
- Should item diffs include condition changes or only location changes?

---

## Tasks

- [x] Compare icon in `ChapterTimelineBar` when chapter is active
- [x] Chapter selector (both sides free-pick from all chapters)
- [x] Last-event-of-chapter resolution for snapshot loading
- [x] Character location + alive/dead diffs with `DiffTag`
- [x] Relationship sentiment + strength + active/inactive diffs
- [x] Item placement diffs
- [x] `DiffTag` and `SectionHeader` sub-components
