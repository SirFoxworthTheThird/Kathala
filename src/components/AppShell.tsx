import { Outlet, useParams, useMatch } from 'react-router-dom'
import { TopBar } from './TopBar'
import { NavRail } from './NavRail'
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
import { RecentChangesPanel } from '@/features/history/RecentChangesPanel'
import { UndoToastBridge } from '@/features/history/UndoToastBridge'
import { useRedoAction, useUndoAction } from '@/features/history/useUndo'
import { useJournalPruning } from '@/db/hooks/useOperations'
import { ReadingGateProvider } from '@/db/hooks/ReadingGateContext'
import { useReadingMode } from '@/db/hooks/useReading'
import { Toaster } from '@/components/ui/toast'
import { db } from '@/db/database'
import { firstEventId } from '@/lib/spoilers'

export function AppShell() {
  const { worldId } = useParams<{ worldId: string }>()
  const { setActiveWorldId, setSearchOpen, setActiveWorldTheme, activeEventId, setActiveEventId, navPinned } = useAppStore()
  const world = useWorld(worldId ?? null)
  // Reading mode decides where a book opens, and takes undo and redo off the
  // top bar — the shortcuts have to go with them, or the one route left into
  // editing is the one nobody sees.
  const readingMode = useReadingMode(worldId ?? null)
  /*
    W-1: where the time cursor's own control belongs.

    The finding says the bar is missing on Corkboard and Structure, "the screens
    most about story order", while the top-bar pill still shows a chapter on
    them. Measuring which screens actually *read* `activeEventId` inverted it:
    the Arc grid (8 uses), the Lore roster (4) and the Calendar (2) all answer
    to the cursor and all hid its control, which is worse than the case filed —
    those screens change under a cursor the user cannot reach. Corkboard and
    Structure read nothing; Structure only *sets* it, by opening a scene.

    So the rule is: the bar shows where the cursor means something, and Corkboard
    and Structure were made to mean something (each marks the scene the cursor is
    on) rather than being given a control that moved nothing.

    Still hidden, on the evidence: the dashboard and settings, neither of which
    has a moment in it, and the lore page editor, which is a full-height writing
    surface like Focus mode. Factions is left alone deliberately — it does not
    read the cursor and was not filed, and expanding past both would be guessing.
  */
  const isDashboard = !!useMatch('/worlds/:worldId')
  const isSettings = !!useMatch('/worlds/:worldId/settings')
  const isLorePage = !!useMatch('/worlds/:worldId/lore/:pageId')
  const isFactions = !!useMatch('/worlds/:worldId/factions')
  const showBar = !isDashboard && !isSettings && !isLorePage && !isFactions
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

  // Open a book at its first moment the first time it is read.
  //
  // Only when there is no remembered place at all: a stored null means the
  // reader asked for all chapters and should get it back. Reading worlds only —
  // a writer opening their own draft wants the whole thing, which is what null
  // already gives them.
  useEffect(() => {
    if (!worldId || !readingMode) return
    if (worldId in useAppStore.getState().eventByWorld) return
    let cancelled = false
    void (async () => {
      const [events, chapters] = await Promise.all([
        db.events.where('worldId').equals(worldId).toArray(),
        db.chapters.where('worldId').equals(worldId).toArray(),
      ])
      const opening = firstEventId(events, new Map(chapters.map((c) => [c.id, c.number])))
      // Re-check on the way back: the world may have changed under the await,
      // and the reader may have moved the cursor themselves in the meantime.
      if (cancelled || !opening) return
      if (worldId in useAppStore.getState().eventByWorld) return
      setActiveEventId(opening)
    })()
    return () => { cancelled = true }
  }, [worldId, readingMode, setActiveEventId])

  // Apply per-world theme override via store — ThemeProvider owns the DOM
  useEffect(() => {
    setActiveWorldTheme(world?.theme ?? null)
    return () => setActiveWorldTheme(null)
  }, [world?.theme, setActiveWorldTheme])

  useAutoFolderSync(worldId)
  useJournalPruning(worldId ?? null)

  const undo = useUndoAction(worldId ?? null)
  const redo = useRedoAction(worldId ?? null)

  // Global Cmd/Ctrl+K to open search, Cmd/Ctrl+Z to undo
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen(true)
        return
      }
      const key = e.key.toLowerCase()
      const isUndoKey = (e.metaKey || e.ctrlKey) && key === 'z' && !e.shiftKey
      // Both conventions: ⇧⌘Z on Mac and most editors, Ctrl+Y on Windows.
      const isRedoKey = (e.metaKey || e.ctrlKey) && ((key === 'z' && e.shiftKey) || key === 'y')
      if ((isUndoKey || isRedoKey) && !readingMode) {
        // Inside a text field the browser's own undo is the one the user means
        // — it works at keystroke granularity and this one does not.
        const el = e.target as HTMLElement | null
        const tag = el?.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA' || el?.isContentEditable) return
        e.preventDefault()
        void (isRedoKey ? redo() : undo())
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setSearchOpen, undo, redo, readingMode])

  return (
    <ReadingGateProvider worldId={worldId ?? null}>
    <div
      data-nav-rail={navPinned ? 'pinned' : 'collapsed'}
      className="flex h-[100dvh] flex-col overflow-hidden"
    >
      <TopBar />
      {world && <NavRail />}
      {showBar && <ChapterTimelineBar />}
      <main
        className="flex-1 overflow-auto"
        style={{ paddingBottom: showBar ? barHeight : undefined, paddingLeft: 'var(--pw-nav-w)' }}
      >
        <Outlet />
      </main>
      <SearchPalette />
      <WritersBriefPanel />
      <ChapterDiffModal />
      <ContinuityChecker />
      <HelpPanel />
      <RecentChangesPanel worldId={worldId ?? null} />
      <UndoToastBridge worldId={worldId ?? null} />
      <Toaster />
    </div>
    </ReadingGateProvider>
  )
}
