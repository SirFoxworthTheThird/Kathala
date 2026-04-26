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
import { db } from '@/db/database'

export function AppShell() {
  const { worldId } = useParams<{ worldId: string }>()
  const { setActiveWorldId, setSearchOpen, setActiveWorldTheme, activeEventId, setActiveEventId } = useAppStore()
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

  // Guard against a stale activeEventId persisted in localStorage that points to a
  // deleted event (e.g. after folder sync or world replace while the app was closed).
  useEffect(() => {
    if (!activeEventId) return
    db.events.get(activeEventId).then((ev) => {
      if (!ev) setActiveEventId(null)
    })
  // Only validate on mount and on world change — not every time activeEventId changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [worldId])

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
