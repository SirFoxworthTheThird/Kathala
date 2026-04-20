import { describe, it, expect, beforeEach } from 'vitest'
import { useAppStore } from '@/store'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const INITIAL = {
  activeWorldId: null,
  activeEventId: null,
  activeMapLayerId: null,
  mapLayerHistory: [],
  sidebarOpen: true,
  selectedLocationMarkerId: null,
  selectedCharacterId: null,
  theme: 'default',
  isPlayingStory: false,
  playbackSpeed: 'normal',
  searchOpen: false,
  briefOpen: false,
  diffOpen: false,
  checkerOpen: false,
}

beforeEach(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  useAppStore.setState(INITIAL as any)
})

// ── WorldSlice ────────────────────────────────────────────────────────────────

describe('WorldSlice', () => {
  it('sets the active world id', () => {
    useAppStore.getState().setActiveWorldId('world-1')
    expect(useAppStore.getState().activeWorldId).toBe('world-1')
  })

  it('clears the active event when the world changes', () => {
    useAppStore.setState({ activeEventId: 'ev-1' })
    useAppStore.getState().setActiveWorldId('world-2')
    expect(useAppStore.getState().activeEventId).toBeNull()
  })

  it('accepts null to clear the active world', () => {
    useAppStore.setState({ activeWorldId: 'world-1' })
    useAppStore.getState().setActiveWorldId(null)
    expect(useAppStore.getState().activeWorldId).toBeNull()
  })
})

// ── EventSlice ────────────────────────────────────────────────────────────────

describe('EventSlice', () => {
  it('sets the active event id', () => {
    useAppStore.getState().setActiveEventId('ev-1')
    expect(useAppStore.getState().activeEventId).toBe('ev-1')
  })

  it('accepts null to clear the active event', () => {
    useAppStore.setState({ activeEventId: 'ev-1' })
    useAppStore.getState().setActiveEventId(null)
    expect(useAppStore.getState().activeEventId).toBeNull()
  })
})

// ── MapSlice ──────────────────────────────────────────────────────────────────

describe('MapSlice — setActiveMapLayerId', () => {
  it('sets the active layer and resets history to a single entry', () => {
    useAppStore.setState({ mapLayerHistory: ['old-1', 'old-2'] })
    useAppStore.getState().setActiveMapLayerId('layer-root')
    expect(useAppStore.getState().activeMapLayerId).toBe('layer-root')
    expect(useAppStore.getState().mapLayerHistory).toEqual(['layer-root'])
  })
})

describe('MapSlice — pushMapLayer', () => {
  it('appends to history and updates the active layer', () => {
    useAppStore.getState().setActiveMapLayerId('root')
    useAppStore.getState().pushMapLayer('child-1')
    expect(useAppStore.getState().activeMapLayerId).toBe('child-1')
    expect(useAppStore.getState().mapLayerHistory).toEqual(['root', 'child-1'])
  })

  it('supports multiple levels of depth', () => {
    useAppStore.getState().setActiveMapLayerId('root')
    useAppStore.getState().pushMapLayer('child-1')
    useAppStore.getState().pushMapLayer('child-2')
    expect(useAppStore.getState().activeMapLayerId).toBe('child-2')
    expect(useAppStore.getState().mapLayerHistory).toEqual(['root', 'child-1', 'child-2'])
  })
})

describe('MapSlice — popMapLayer', () => {
  it('navigates back to the previous layer', () => {
    useAppStore.getState().setActiveMapLayerId('root')
    useAppStore.getState().pushMapLayer('child-1')
    useAppStore.getState().popMapLayer()
    expect(useAppStore.getState().activeMapLayerId).toBe('root')
    expect(useAppStore.getState().mapLayerHistory).toEqual(['root'])
  })

  it('sets activeMapLayerId to null when popping the last entry', () => {
    useAppStore.getState().setActiveMapLayerId('root')
    useAppStore.getState().popMapLayer()
    expect(useAppStore.getState().activeMapLayerId).toBeNull()
    expect(useAppStore.getState().mapLayerHistory).toEqual([])
  })

  it('is a no-op (null) when history is already empty', () => {
    useAppStore.getState().popMapLayer()
    expect(useAppStore.getState().activeMapLayerId).toBeNull()
  })

  it('correctly unwinds multiple levels', () => {
    useAppStore.getState().setActiveMapLayerId('root')
    useAppStore.getState().pushMapLayer('child-1')
    useAppStore.getState().pushMapLayer('child-2')
    useAppStore.getState().popMapLayer()
    useAppStore.getState().popMapLayer()
    expect(useAppStore.getState().activeMapLayerId).toBe('root')
    expect(useAppStore.getState().mapLayerHistory).toEqual(['root'])
  })
})

describe('MapSlice — resetMapHistory', () => {
  it('discards deep history and resets to the given root', () => {
    useAppStore.getState().setActiveMapLayerId('root')
    useAppStore.getState().pushMapLayer('child-1')
    useAppStore.getState().pushMapLayer('child-2')
    useAppStore.getState().resetMapHistory('new-root')
    expect(useAppStore.getState().activeMapLayerId).toBe('new-root')
    expect(useAppStore.getState().mapLayerHistory).toEqual(['new-root'])
  })
})

// ── PlaybackSlice ─────────────────────────────────────────────────────────────

describe('PlaybackSlice', () => {
  it('starts with playback off and normal speed', () => {
    const { isPlayingStory, playbackSpeed } = useAppStore.getState()
    expect(isPlayingStory).toBe(false)
    expect(playbackSpeed).toBe('normal')
  })

  it('sets isPlayingStory to true', () => {
    useAppStore.getState().setIsPlayingStory(true)
    expect(useAppStore.getState().isPlayingStory).toBe(true)
  })

  it('sets isPlayingStory back to false', () => {
    useAppStore.setState({ isPlayingStory: true })
    useAppStore.getState().setIsPlayingStory(false)
    expect(useAppStore.getState().isPlayingStory).toBe(false)
  })

  it('sets playback speed to slow', () => {
    useAppStore.getState().setPlaybackSpeed('slow')
    expect(useAppStore.getState().playbackSpeed).toBe('slow')
  })

  it('sets playback speed to fast', () => {
    useAppStore.getState().setPlaybackSpeed('fast')
    expect(useAppStore.getState().playbackSpeed).toBe('fast')
  })

  it('cycles through all three speeds independently', () => {
    useAppStore.getState().setPlaybackSpeed('slow')
    expect(useAppStore.getState().playbackSpeed).toBe('slow')
    useAppStore.getState().setPlaybackSpeed('normal')
    expect(useAppStore.getState().playbackSpeed).toBe('normal')
    useAppStore.getState().setPlaybackSpeed('fast')
    expect(useAppStore.getState().playbackSpeed).toBe('fast')
  })

  it('changing playback speed does not affect isPlayingStory', () => {
    useAppStore.setState({ isPlayingStory: true })
    useAppStore.getState().setPlaybackSpeed('slow')
    expect(useAppStore.getState().isPlayingStory).toBe(true)
  })

  it('stopping playback does not reset playback speed', () => {
    useAppStore.getState().setPlaybackSpeed('fast')
    useAppStore.getState().setIsPlayingStory(false)
    expect(useAppStore.getState().playbackSpeed).toBe('fast')
  })
})

// ── OverlaySlice (search / brief / diff) ─────────────────────────────────────

describe('OverlaySlice', () => {
  it('opens and closes search', () => {
    useAppStore.getState().setSearchOpen(true)
    expect(useAppStore.getState().searchOpen).toBe(true)
    useAppStore.getState().setSearchOpen(false)
    expect(useAppStore.getState().searchOpen).toBe(false)
  })

  it('opens and closes brief', () => {
    useAppStore.getState().setBriefOpen(true)
    expect(useAppStore.getState().briefOpen).toBe(true)
    useAppStore.getState().setBriefOpen(false)
    expect(useAppStore.getState().briefOpen).toBe(false)
  })

  it('opens and closes diff', () => {
    useAppStore.getState().setDiffOpen(true)
    expect(useAppStore.getState().diffOpen).toBe(true)
    useAppStore.getState().setDiffOpen(false)
    expect(useAppStore.getState().diffOpen).toBe(false)
  })

  it('opens and closes checker', () => {
    useAppStore.getState().setCheckerOpen(true)
    expect(useAppStore.getState().checkerOpen).toBe(true)
    useAppStore.getState().setCheckerOpen(false)
    expect(useAppStore.getState().checkerOpen).toBe(false)
  })

  it('overlays are independent of each other', () => {
    useAppStore.getState().setSearchOpen(true)
    useAppStore.getState().setBriefOpen(true)
    expect(useAppStore.getState().diffOpen).toBe(false)
    useAppStore.getState().setDiffOpen(true)
    useAppStore.getState().setCheckerOpen(true)
    expect(useAppStore.getState().searchOpen).toBe(true)
    expect(useAppStore.getState().briefOpen).toBe(true)
    expect(useAppStore.getState().checkerOpen).toBe(true)
  })
})

// ── UISlice ───────────────────────────────────────────────────────────────────

describe('UISlice', () => {
  it('toggles sidebar open/closed', () => {
    useAppStore.setState({ sidebarOpen: true })
    useAppStore.getState().toggleSidebar()
    expect(useAppStore.getState().sidebarOpen).toBe(false)
    useAppStore.getState().toggleSidebar()
    expect(useAppStore.getState().sidebarOpen).toBe(true)
  })

  it('sets sidebar explicitly', () => {
    useAppStore.getState().setSidebarOpen(false)
    expect(useAppStore.getState().sidebarOpen).toBe(false)
    useAppStore.getState().setSidebarOpen(true)
    expect(useAppStore.getState().sidebarOpen).toBe(true)
  })

  it('sets the active theme', () => {
    useAppStore.getState().setTheme('fantasy')
    expect(useAppStore.getState().theme).toBe('fantasy')
    useAppStore.getState().setTheme('cyberpunk')
    expect(useAppStore.getState().theme).toBe('cyberpunk')
  })

  it('sets the selected location marker', () => {
    useAppStore.getState().setSelectedLocationMarkerId('loc-1')
    expect(useAppStore.getState().selectedLocationMarkerId).toBe('loc-1')
    useAppStore.getState().setSelectedLocationMarkerId(null)
    expect(useAppStore.getState().selectedLocationMarkerId).toBeNull()
  })

  it('sets the selected character', () => {
    useAppStore.getState().setSelectedCharacterId('char-1')
    expect(useAppStore.getState().selectedCharacterId).toBe('char-1')
    useAppStore.getState().setSelectedCharacterId(null)
    expect(useAppStore.getState().selectedCharacterId).toBeNull()
  })

})
