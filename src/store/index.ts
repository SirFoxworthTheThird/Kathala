import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface WorldSlice {
  activeWorldId: string | null
  setActiveWorldId: (id: string | null) => void
}

interface EventSlice {
  activeEventId: string | null
  setActiveEventId: (id: string | null) => void
}

interface MapSlice {
  activeMapLayerId: string | null
  mapLayerHistory: string[]
  setActiveMapLayerId: (id: string) => void
  pushMapLayer: (id: string) => void
  popMapLayer: () => void
  resetMapHistory: (rootId: string) => void
}

export type AppTheme = 'default' | 'fantasy' | 'scifi' | 'cyberpunk' | 'horror' | 'western' | 'action' | 'noir' | 'romance'
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
  /** When a frame narrative is active: the current event on the outer (frame) timeline.
   *  Drives ghost pin positions. Separate from activeEventId which tracks the inner timeline. */
  activeOuterEventId: string | null
  setActiveOuterEventId: (id: string | null) => void
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
  suppressedIssueIds: Record<string, string[]>
  toggleSuppressIssue: (worldId: string, id: string) => void
  isAnimating: boolean
  setIsAnimating: (v: boolean) => void
  /** Set before navigating to Maps to auto-select + focus a route on arrival. */
  pendingFocusRouteId: string | null
  setPendingFocusRouteId: (id: string | null) => void
  /** Set before navigating to Maps to auto-select + focus a region on arrival. */
  pendingFocusRegionId: string | null
  setPendingFocusRegionId: (id: string | null) => void
}

type AppStore = WorldSlice & EventSlice & MapSlice & UISlice & PlaybackSlice & SelectionSlice

export const useAppStore = create<AppStore>()(
  persist(
    (set, _get) => ({
      // World
      activeWorldId: null,
      setActiveWorldId: (id) => set({ activeWorldId: id, activeEventId: null, activeMapLayerId: null, mapLayerHistory: [] }),

      // Event (the global time cursor — replaces activeChapterId)
      activeEventId: null,
      setActiveEventId: (id) => set({ activeEventId: id }),

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

      // Selection (not persisted)
      selectedEventIds: new Set<string>(),
      lastSelectedEventId: null,
      toggleEventSelected: (id) => set((s) => {
        const next = new Set(s.selectedEventIds)
        next.has(id) ? next.delete(id) : next.add(id)
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
      activeOuterEventId: null,
      setActiveOuterEventId: (id) => set({ activeOuterEventId: id }),
      activeDepthTimelineId: null,
      setActiveDepthTimelineId: (id) => set({ activeDepthTimelineId: id }),

      // UI
      sidebarOpen: true,
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
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
      suppressedIssueIds: {},
      toggleSuppressIssue: (worldId, id) => set((s) => {
        const current = s.suppressedIssueIds[worldId] ?? []
        const next = current.includes(id)
          ? current.filter((x) => x !== id)
          : [...current, id]
        return { suppressedIssueIds: { ...s.suppressedIssueIds, [worldId]: next } }
      }),
      isAnimating: false,
      setIsAnimating: (v) => set({ isAnimating: v }),
      pendingFocusRouteId: null,
      setPendingFocusRouteId: (id) => set({ pendingFocusRouteId: id }),
      pendingFocusRegionId: null,
      setPendingFocusRegionId: (id) => set({ pendingFocusRegionId: id }),
    }),
    {
      name: 'plotweave-ui',
      partialize: (state) => ({
        activeWorldId: state.activeWorldId,
        activeEventId: state.activeEventId,
        sidebarOpen: state.sidebarOpen,
        suppressedIssueIds: state.suppressedIssueIds,
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

