import { Outlet, useParams, useMatch } from 'react-router-dom'
import { TopBar } from './TopBar'
import { ChapterTimelineBar } from './ChapterTimelineBar'
import { useAppStore } from '@/store'
import { useBarHeight } from '@/lib/useBarHeight'
import { useEffect } from 'react'
import { SearchPalette } from '@/features/search/SearchPalette'
import { useAutoFolderSync } from '@/features/worlds/useAutoFolderSync'
import { useWorld } from '@/db/hooks/useWorlds'
import { WritersBriefPanel } from '@/features/brief/WritersBriefPanel'
import { ChapterDiffModal } from '@/features/diff/ChapterDiffModal'
import { ContinuityChecker } from '@/features/continuity/ContinuityChecker'
import { HelpPanel } from '@/features/help/HelpPanel'

export function AppShell() {
  const { worldId } = useParams<{ worldId: string }>()
  const { setActiveWorldId, setSearchOpen, setActiveWorldTheme } = useAppStore()
  const world = useWorld(worldId ?? null)
  const isDashboard = !!useMatch('/worlds/:worldId')
  const isArc = !!useMatch('/worlds/:worldId/arc')
  const isSettings = !!useMatch('/worlds/:worldId/settings')
  const isLore = !!useMatch('/worlds/:worldId/lore/*')
  const isFactions = !!useMatch('/worlds/:worldId/factions')
  const showBar = !isDashboard && !isArc && !isSettings && !isLore && !isFactions
  const barHeight = useBarHeight(showBar ? worldId : null)

  useEffect(() => {
    if (worldId) setActiveWorldId(worldId)
  }, [worldId, setActiveWorldId])

  // Apply per-world theme override via store — ThemeProvider owns the DOM
  useEffect(() => {
    setActiveWorldTheme(world?.theme ?? null)
    return () => setActiveWorldTheme(null)
  }, [world?.theme, setActiveWorldTheme])

  useAutoFolderSync(worldId)

  // Global Cmd/Ctrl+K to open search
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setSearchOpen])

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <TopBar />
      {showBar && <ChapterTimelineBar />}
      <main className="flex-1 overflow-auto" style={{ paddingBottom: showBar ? barHeight : undefined }}>
        <Outlet />
      </main>
      <SearchPalette />
      <WritersBriefPanel />
      <ChapterDiffModal />
      <ContinuityChecker />
      <HelpPanel />
    </div>
  )
}
