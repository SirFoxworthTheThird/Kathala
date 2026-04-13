# Feature: Chapter Timeline Bar

## Overview

The `ChapterTimelineBar` is the persistent navigation and playback control bar fixed at the bottom of every non-dashboard page. It is the app's primary time cursor — clicking a chapter or event dot sets `activeEventId` in Zustand, which drives every other view. It also hosts playback controls and the chapter diff trigger.

---

## What Already Works

- **Fixed bottom overlay** — always visible on world pages; height is `BAR_H = 3.25rem`; z-indexed above all page content
- **Chapter dots** — one dot per chapter; active chapter dot is highlighted; click to set the active event to the last event of that chapter
- **Event dots** — sub-dots beneath each chapter dot, one per event; active event dot highlighted
- **Horizontal scrolling** — `overflowX: auto` on the inner scroller; vertical mouse-wheel converted to horizontal `scrollBy`; left/right arrow buttons appear at the edges when content overflows (`canScrollLeft`, `canScrollRight` state updated by `ResizeObserver` + scroll listener)
- **Callout** (`Callout` component) — floating info card above the active chapter dot: shows chapter number, title, event title + synopsis; prev/next navigation chevrons; auto-dismisses after 4 s
- **"All" button** — deselects the active event (sets `activeEventId` to `null`); shows all data unfiltered
- **Playback controls:**
  - **Play/Pause** — toggles `isPlayingStory`; auto-navigates to the map view on Play
  - **Stop** — stops playback and returns cursor to the pre-play position
  - **Speed** — cycles `slow → normal → fast`; labels `1× / 2× / 3×`; controls both animation speed and `readingHoldMs`
  - **`isAnimating` guard** — auto-advance timer only fires when `isPlayingStory && !isAnimating`; prevents the cursor from jumping while map animation is running
- **Auto-advance** — `useEffect` timer reads `readingHoldMs(eventText, playbackSpeed)` per event and calls `setActiveEventId` with the next event in global order; stops at the last event
- **Chapter diff trigger** — compare icon shown when a chapter is active; sets `diffOpen: true` in the Zustand store
- **Theme-aware** — all colours, fonts, glow effects, pulse animations read from CSS custom properties set by `ThemeProvider`

---

## User Stories

- As a writer, I want the timeline bar to show chapter numbers on hover so I can jump to a specific chapter quickly with large stories.
- As a writer, I want to click an event dot directly to jump to that event without going through the chapter.
- As a writer, I want to pin the timeline bar at the top of the screen instead of the bottom as an option.

---

## Technical Approach

### Key files
- `src/components/ChapterTimelineBar.tsx` — full implementation (466 lines)
- `src/store/index.ts` — `activeEventId`, `isPlayingStory`, `isAnimating`, `playbackSpeed`, `diffOpen` + setters
- `src/lib/playback.ts` — `readingHoldMs(text, speed)` helper; estimates reading time from word count

### Global event ordering
```typescript
orderedEvents = [...allEvents].sort((a, b) =>
  (chapterNumById.get(a.chapterId) * 10_000 + a.sortOrder) -
  (chapterNumById.get(b.chapterId) * 10_000 + b.sortOrder)
)
```
Playback advances through `orderedEvents` in this order; `activeEventIndex` tracks position.

### Horizontal scroll implementation
```typescript
// Wheel → horizontal scroll
scrollerRef.current.scrollBy({ left: e.deltaY, behavior: 'smooth' })

// Arrow visibility
updateScrollArrows = useCallback(() => {
  const el = scrollerRef.current
  setCanScrollLeft(el.scrollLeft > 0)
  setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1)
}, [])
// Registered as both scroll listener and ResizeObserver callback
```

### `isAnimating` guard
```typescript
useEffect(() => {
  if (!isPlayingStory || isAnimating) return
  // ... advance timer
}, [isPlayingStory, isAnimating, activeEventId, orderedEvents, playbackSpeed])
```
`setIsAnimating(true)` is called by `LeafletMapCanvas` when animation starts; `setIsAnimating(false)` when it ends. The timer effect re-runs only after `isAnimating` returns to `false`.

---

## Tasks

- [x] Chapter and event dots with active highlighting
- [x] Callout with chapter info, prev/next chevrons, auto-dismiss
- [x] "All" deselect button
- [x] Playback controls (Play/Pause, Stop, Speed)
- [x] Auto-advance timer with `readingHoldMs` per event
- [x] `isAnimating` guard preventing advance during map animation
- [x] Horizontal scroll with mouse-wheel conversion and arrow buttons
- [x] Chapter diff trigger icon
- [x] Theme-aware styling via CSS custom properties
