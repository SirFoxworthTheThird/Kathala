import { Outlet, useParams, useMatch } from 'react-router-dom'
import { TopBar } from './TopBar'
import { ChapterTimelineBar } from './ChapterTimelineBar'
import { useAppStore } from '@/store'
import { useBarHeight } from '@/lib/useBarHeight'
import { useEffect } from 'react'
import { SearchPalette } from '@/features/search/SearchPalette'
import { WritersBriefPanel } from '@/features/brief/WritersBriefPanel'
import { ChapterDiffModal } from '@/features/diff/ChapterDiffModal'
import { ContinuityChecker } from '@/features/continuity/ContinuityChecker'
import { TutorialWizard } from '@/features/tutorial/TutorialWizard'

export function AppShell() {
  const { worldId } = useParams<{ worldId: string }>()
  const { setActiveWorldId, setSearchOpen } = useAppStore()
  const isDashboard = !!useMatch('/worlds/:worldId')
  const barHeight = useBarHeight(isDashboard ? null : worldId)

  useEffect(() => {
    if (worldId) setActiveWorldId(worldId)
  }, [worldId, setActiveWorldId])

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
      {!isDashboard && <ChapterTimelineBar />}
      <main className="flex-1 overflow-auto" style={{ paddingBottom: !isDashboard ? barHeight : undefined }}>
        <Outlet />
      </main>
      <SearchPalette />
      <WritersBriefPanel />
      <ChapterDiffModal />
      <ContinuityChecker />
      <TutorialWizard />
    </div>
  )
}
