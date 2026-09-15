import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { DEFAULT_READING_TYPE, coerceReadingType, type ReadingType } from '@/lib/readingType'

interface WorldSlice {
  activeWorldId: string | null
  setActiveWorldId: (id: string | null) => void
}

interface EventSlice {
  activeEventId: string | null
  setActiveEventId: (id: string | null) => void
  /** Place a world at its first scene, unless it already has a position. */
  /** How the reader wants a book set. Theirs, not any book's. */
  readingType: ReadingType
  setReadingType: (next: Partial<ReadingType>) => void
  seedReadingPosition: (worldId: string, eventId: string) => void
  /** Where each seeded world opened, so "unread" stays tellable from "read a bit". */
  openingByWorld: Record<string, string>
  /**
   * Where the cursor was left in each world, so reopening one resumes rather
   * than restarts.
   *
   * This began as a spoiler leak rather than a convenience. Switching worlds
   * cleared `activeEventId`, and a null cursor means "all chapters" — full
   * reveal. So a reader five chapters into a book who closed it and came back
   * was silently shown the whole thing, which is the one thing reading mode
   * exists to prevent.
   *
   * Key presence is meaningful. A stored `null` is a reader who deliberately
   * asked for all chapters and should get it back; a *missing* key is a world
   * never opened, which is what lets a fresh book start at its first moment
   * instead of fully revealed.
   */
  eventByWorld: Record<string, string | null>
}

interface MapSlice {
  activeMapLayerId: string | null
  mapLayerHistory: string[]
  setActiveMapLayerId: (id: string) => void
  pushMapLayer: (id: string) => void
  popMapLayer: () => void
  resetMapHistory: (rootId: string) => void
  /** Switch the current map in place (e.g. between floors) without changing breadcrumb depth. */
  swapActiveMapLayer: (id: string) => void
}

export type AppTheme =
  | 'default' | 'fantasy' | 'scifi' | 'cyberpunk' | 'horror' | 'western' | 'action' | 'noir' | 'romance'
  | 'gothic' | 'mystery' | 'mythic' | 'adventure'
  | 'dystopian' | 'historical' | 'cosy' | 'paper'
export type PlaybackSpeed = 'slow' | 'normal' | 'fast'

interface PlaybackSlice {
  isPlayingStory: boolean
  playbackSpeed: PlaybackSpeed
  setIsPlayingStory: (v: boolean) => void
  setPlaybackSpeed: (speed: PlaybackSpeed) => void
  /** The timeline whose events drive playback and map character positions.
   *  null = fall back to timelines[0] (existing behaviour). */
  playbackTimelineId: string | null
  setPlaybackTimelineId: (id: string | null) => void
  /** What the bottom timeline bar shows in a multi-timeline world: a specific
   *  timeline id, or the sentinels 'all-chrono' / 'all-chapter' for a merged
   *  view. null = the default (chapter-order merge). Frame narratives ignore
   *  this and keep their stacked sync view. */
  barScope: string | null
  setBarScope: (scope: string | null) => void
  /** When a frame narrative is active: the current event on the outer (frame) timeline.
   *  Drives ghost pin positions. Separate from activeEventId which tracks the inner timeline. */
  activeOuterEventId: string | null
  setActiveOuterEventId: (id: string | null) => void
  /**
   * Whether the chapter bar is rolled up to a strip (MT-3). Persisted, because
   * someone who put 100px of chrome away on the map did not mean "until the
   * next navigation".
   */
  barCollapsed: boolean
  setBarCollapsed: (v: boolean) => void
  /**
   * Whether the search palette matches whole words only. Persisted for the same
   * reason as the bar above: a writer whose invented names are short — `Bel`,
   * `tin` — turns this on once and means it, not once per palette.
   */
  searchWholeWord: boolean
  setSearchWholeWord: (v: boolean) => void
  /** The timeline currently shown as the "active depth" in the stacked timeline bar.
   *  null = no frame relationship active. */
  activeDepthTimelineId: string | null
  setActiveDepthTimelineId: (id: string | null) => void
}

interface SelectionSlice {
  selectedEventIds: Set<string>
  lastSelectedEventId: string | null
  toggleEventSelected: (id: string) => void
  selectEventRange: (ids: string[]) => void
  clearSelection: () => void
  setLastSelectedEventId: (id: string | null) => void
}

interface UISlice {
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
  toggleSidebar: () => void
  /** Whether the desktop nav rail is pinned open (labels always shown). */
  navPinned: boolean
  setNavPinned: (pinned: boolean) => void
  selectedLocationMarkerId: string | null
  setSelectedLocationMarkerId: (id: string | null) => void
  selectedCharacterId: string | null
  setSelectedCharacterId: (id: string | null) => void
  theme: AppTheme
  setTheme: (theme: AppTheme) => void
  activeWorldTheme: string | null
  setActiveWorldTheme: (t: string | null) => void
  searchOpen: boolean
  setSearchOpen: (open: boolean) => void
  briefOpen: boolean
  setBriefOpen: (open: boolean) => void
  helpOpen: boolean
  setHelpOpen: (open: boolean) => void
  diffOpen: boolean
  setDiffOpen: (open: boolean) => void
  checkerOpen: boolean
  setCheckerOpen: (open: boolean) => void
  isAnimating: boolean
  setIsAnimating: (v: boolean) => void
  /** Set before navigating to Maps to auto-select + focus a route on arrival. */
  pendingFocusRouteId: string | null
  setPendingFocusRouteId: (id: string | null) => void
  /** Set before navigating to Maps to auto-select + focus a region on arrival. */
  pendingFocusRegionId: string | null
  setPendingFocusRegionId: (id: string | null) => void
  /** Set before navigating to Maps to auto-pan to a location marker on arrival. */
  pendingFocusMarkerId: string | null
  setPendingFocusMarkerId: (id: string | null) => void
  /** History panel — the persistent home for undo, and the only one on mobile. */
  historyOpen: boolean
  setHistoryOpen: (open: boolean) => void
}

/**
 * Transient messages. Deliberately not persisted: a toast that survived a
 * reload would be offering to undo something the user did in another session.
 */
export interface Toast {
  id: string
  message: string
  /** Shown as an action button; omitted for a plain notice. */
  actionLabel?: string
  onAction?: () => void
}

interface ToastSlice {
  toasts: Toast[]
  pushToast: (toast: Omit<Toast, 'id'> & { id?: string }) => string
  dismissToast: (id: string) => void
}

type AppStore = WorldSlice & EventSlice & MapSlice & UISlice & PlaybackSlice & SelectionSlice & ToastSlice

export const useAppStore = create<AppStore>()(
  persist(
    (set, _get) => ({
      // World
      activeWorldId: null,
      setActiveWorldId: (id) => set((state) => ({
        activeWorldId: id,
        // Resume where this world was left rather than resetting to null. Null
        // is not a neutral starting point — it means "all chapters", which for
        // a book someone is part-way through is the whole plot.
        activeEventId: id && id in state.eventByWorld ? state.eventByWorld[id] : null,
        activeMapLayerId: null,
        mapLayerHistory: [],
        pendingFocusRouteId: null,
        pendingFocusRegionId: null,
        pendingFocusMarkerId: null,
      })),

      // Event (the global time cursor — replaces activeChapterId)
      activeEventId: null,
      eventByWorld: {},
      openingByWorld: {},
      setActiveEventId: (id) => set((state) => {
        const worldId = state.activeWorldId
        if (!worldId) return { activeEventId: id }
        // Recorded either way, including null: choosing "all chapters" is a
        // decision, and the next visit should honour it rather than quietly
        // putting the reader back at the start.
        return { activeEventId: id, eventByWorld: { ...state.eventByWorld, [worldId]: id } }
      }),
      /*
        Start a newly imported world at its opening scene, unless it already has
        a position of its own.

        A downloaded book has no remembered position, and no position means a
        null cursor, which means *all chapters* — so opening a freshly
        downloaded Dracula showed its entire cast, every place and all of its
        lore before a word was read.

        A *stored event id* is the reader's place and is never overwritten:
        re-importing a `.pwk` of a book someone is midway through leaves them
        midway through it.

        A stored `null` is not treated the same way, and that is the whole of
        this guard's subtlety. Null means "all chapters" — a deliberate full
        reveal — but it belongs to the copy the reader chose it on, and the
        catalogue gives every Library world a fixed id, so the key outlives the
        world itself. Reveal all on Alice, delete it, download it again, and the
        new copy inherited the old copy's null: the cursor could not move
        (`cursorForScene` refuses to advance a null), the bar named no chapter
        (it is guarded on finding the active event), and re-downloading — the
        one thing a reader would try — could not clear it. Reading mode was
        silently dead for that book, for good.

        So an arriving world may overrule a null. That is safe because *only*
        arrival reaches here: a Library download and a `.pwk` import, never
        opening a world already in hand. A reveal-all on the copy being read is
        untouched, which `readingReseed.spec.ts` checks in the same run.
      */
      /*
        Coerced on the way out of storage rather than trusted: this is persisted,
        so a build that changes the size ladder or renames a leading will meet
        readers still holding the old one, and `line-height: undefined` collapses
        a column rather than failing loudly.
      */
      readingType: DEFAULT_READING_TYPE,
      setReadingType: (next) => set((state) => ({
        readingType: coerceReadingType({ ...state.readingType, ...next }),
      })),

      seedReadingPosition: (worldId, eventId) => set((state) => {
        if (state.eventByWorld[worldId] != null) return {}
        return {
          eventByWorld: { ...state.eventByWorld, [worldId]: eventId },
          // Kept so "where the book opens" stays distinguishable from "where
          // the reader got to". They are the same value on day one, and the
          // shelf order depends on telling them apart — see `readingLeads`.
          openingByWorld: { ...state.openingByWorld, [worldId]: eventId },
          ...(state.activeWorldId === worldId ? { activeEventId: eventId } : {}),
        }
      }),

      // Map
      activeMapLayerId: null,
      mapLayerHistory: [],
      setActiveMapLayerId: (id) => set({ activeMapLayerId: id, mapLayerHistory: [id] }),
      pushMapLayer: (id) =>
        set((state) => ({
          activeMapLayerId: id,
          mapLayerHistory: [...state.mapLayerHistory, id],
        })),
      popMapLayer: () =>
        set((state) => {
          const history = state.mapLayerHistory.slice(0, -1)
          return {
            mapLayerHistory: history,
            activeMapLayerId: history[history.length - 1] ?? null,
          }
        }),
      resetMapHistory: (rootId) =>
        set({ activeMapLayerId: rootId, mapLayerHistory: [rootId] }),
      swapActiveMapLayer: (id) =>
        set((state) => {
          const history = state.mapLayerHistory.slice()
          if (history.length) history[history.length - 1] = id
          else history.push(id)
          return { activeMapLayerId: id, mapLayerHistory: history }
        }),

      // Selection (not persisted)
      selectedEventIds: new Set<string>(),
      lastSelectedEventId: null,
      toggleEventSelected: (id) => set((s) => {
        const next = new Set(s.selectedEventIds)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        return { selectedEventIds: next }
      }),
      selectEventRange: (ids) => set((s) => ({
        selectedEventIds: new Set([...s.selectedEventIds, ...ids]),
      })),
      clearSelection: () => set({ selectedEventIds: new Set(), lastSelectedEventId: null }),
      setLastSelectedEventId: (id) => set({ lastSelectedEventId: id }),

      // Playback (not persisted)
      isPlayingStory: false,
      playbackSpeed: 'normal' as PlaybackSpeed,
      setIsPlayingStory: (v) => set({ isPlayingStory: v }),
      setPlaybackSpeed: (speed) => set({ playbackSpeed: speed }),
      playbackTimelineId: null,
      setPlaybackTimelineId: (id) => set({ playbackTimelineId: id }),
      barScope: null,
      setBarScope: (scope) => set({ barScope: scope }),
      activeOuterEventId: null,
      setActiveOuterEventId: (id) => set({ activeOuterEventId: id }),
      barCollapsed: false,
      setBarCollapsed: (v) => set({ barCollapsed: v }),
      searchWholeWord: false,
      setSearchWholeWord: (v) => set({ searchWholeWord: v }),
      activeDepthTimelineId: null,
      setActiveDepthTimelineId: (id) => set({ activeDepthTimelineId: id }),

      // UI
      sidebarOpen: true,
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
      navPinned: false,
      setNavPinned: (pinned) => set({ navPinned: pinned }),
      selectedLocationMarkerId: null,
      setSelectedLocationMarkerId: (id) => set({ selectedLocationMarkerId: id }),
      selectedCharacterId: null,
      setSelectedCharacterId: (id) => set({ selectedCharacterId: id }),
      theme: 'default',
      setTheme: (theme) => set({ theme }),
      activeWorldTheme: null,
      setActiveWorldTheme: (t) => set({ activeWorldTheme: t }),
      searchOpen: false,
      setSearchOpen: (open) => set({ searchOpen: open }),
      briefOpen: false,
      setBriefOpen: (open) => set({ briefOpen: open }),
      helpOpen: false,
      setHelpOpen: (open) => set({ helpOpen: open }),
      diffOpen: false,
      setDiffOpen: (open) => set({ diffOpen: open }),
      checkerOpen: false,
      setCheckerOpen: (open) => set({ checkerOpen: open }),
      isAnimating: false,
      setIsAnimating: (v) => set({ isAnimating: v }),
      pendingFocusRouteId: null,
      setPendingFocusRouteId: (id) => set({ pendingFocusRouteId: id }),
      pendingFocusRegionId: null,
      setPendingFocusRegionId: (id) => set({ pendingFocusRegionId: id }),
      pendingFocusMarkerId: null,
      setPendingFocusMarkerId: (id) => set({ pendingFocusMarkerId: id }),
      historyOpen: false,
      setHistoryOpen: (open) => set({ historyOpen: open }),

      // Toasts
      toasts: [],
      pushToast: (toast) => {
        const id = toast.id ?? `toast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
        set((state) => ({ toasts: [...state.toasts.filter((t) => t.id !== id), { ...toast, id }] }))
        return id
      },
      dismissToast: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
    }),
    {
      name: 'plotweave-ui',
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<typeof current>
        // Anything else is taken as stored; the type preference is repaired,
        // because it is the one persisted value that reaches CSS directly.
        return { ...current, ...p, readingType: coerceReadingType(p.readingType) }
      },
      partialize: (state) => ({
        activeWorldId: state.activeWorldId,
        activeEventId: state.activeEventId,
        eventByWorld: state.eventByWorld,
        openingByWorld: state.openingByWorld,
        sidebarOpen: state.sidebarOpen,
        navPinned: state.navPinned,
        barScope: state.barScope,
        barCollapsed: state.barCollapsed,
        searchWholeWord: state.searchWholeWord,
        theme: state.theme,
        readingType: state.readingType,
      }),
    }
  )
)

// Convenience selectors
export const useActiveWorldId = () => useAppStore((s) => s.activeWorldId)
export const useActiveEventId = () => useAppStore((s) => s.activeEventId)
export const useActiveMapLayerId = () => useAppStore((s) => s.activeMapLayerId)
export const useMapLayerHistory = () => useAppStore((s) => s.mapLayerHistory)
export const usePlaybackTimelineId = () => useAppStore((s) => s.playbackTimelineId)
export const useActiveDepthTimelineId = () => useAppStore((s) => s.activeDepthTimelineId)
export const useActiveOuterEventId = () => useAppStore((s) => s.activeOuterEventId)

