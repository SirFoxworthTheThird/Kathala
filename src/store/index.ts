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
}

interface UISlice {
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
  toggleSidebar: () => void
  selectedLocationMarkerId: string | null
  setSelectedLocationMarkerId: (id: string | null) => void
  selectedCharacterId: string | null
  setSelectedCharacterId: (id: string | null) => void
  selectedRelationshipId: string | null
  setSelectedRelationshipId: (id: string | null) => void
  theme: AppTheme
  setTheme: (theme: AppTheme) => void
  searchOpen: boolean
  setSearchOpen: (open: boolean) => void
  briefOpen: boolean
  setBriefOpen: (open: boolean) => void
  diffOpen: boolean
  setDiffOpen: (open: boolean) => void
  checkerOpen: boolean
  setCheckerOpen: (open: boolean) => void
  suppressedIssueIds: string[]
  toggleSuppressIssue: (id: string) => void
  isAnimating: boolean
  setIsAnimating: (v: boolean) => void
}

type AppStore = WorldSlice & EventSlice & MapSlice & UISlice & PlaybackSlice

export const useAppStore = create<AppStore>()(
  persist(
    (set, _get) => ({
      // World
      activeWorldId: null,
      setActiveWorldId: (id) => set({ activeWorldId: id, activeEventId: null }),

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

      // Playback (not persisted)
      isPlayingStory: false,
      playbackSpeed: 'normal' as PlaybackSpeed,
      setIsPlayingStory: (v) => set({ isPlayingStory: v }),
      setPlaybackSpeed: (speed) => set({ playbackSpeed: speed }),

      // UI
      sidebarOpen: true,
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
      selectedLocationMarkerId: null,
      setSelectedLocationMarkerId: (id) => set({ selectedLocationMarkerId: id }),
      selectedCharacterId: null,
      setSelectedCharacterId: (id) => set({ selectedCharacterId: id }),
      selectedRelationshipId: null,
      setSelectedRelationshipId: (id) => set({ selectedRelationshipId: id }),
      theme: 'default',
      setTheme: (theme) => set({ theme }),
      searchOpen: false,
      setSearchOpen: (open) => set({ searchOpen: open }),
      briefOpen: false,
      setBriefOpen: (open) => set({ briefOpen: open }),
      diffOpen: false,
      setDiffOpen: (open) => set({ diffOpen: open }),
      checkerOpen: false,
      setCheckerOpen: (open) => set({ checkerOpen: open }),
      suppressedIssueIds: [],
      toggleSuppressIssue: (id) => set((s) => ({
        suppressedIssueIds: s.suppressedIssueIds.includes(id)
          ? s.suppressedIssueIds.filter((x) => x !== id)
          : [...s.suppressedIssueIds, id],
      })),
      isAnimating: false,
      setIsAnimating: (v) => set({ isAnimating: v }),
    }),
    {
      name: 'plotweave-ui',
      partialize: (state) => ({
        activeWorldId: state.activeWorldId,
        activeEventId: state.activeEventId,
        sidebarOpen: state.sidebarOpen,
        theme: state.theme,
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

