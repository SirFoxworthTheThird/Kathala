import { lazy, Suspense } from 'react'
import { createHashRouter, Navigate, useParams } from 'react-router-dom'
import { AppShell } from '@/components/AppShell'
import { useWorld } from '@/db/hooks/useWorlds'
import { navItems } from '@/components/navItems'

const WorldSelectorView = lazy(() => import('@/features/worlds/WorldSelectorView'))
const WorldDashboardView = lazy(() => import('@/features/worlds/WorldDashboardView'))
const MapExplorerView = lazy(() => import('@/features/maps/MapExplorerView'))
const CharacterRosterView = lazy(() => import('@/features/characters/CharacterRosterView'))
const CharacterDetailView = lazy(() => import('@/features/characters/CharacterDetailView'))
const ItemRosterView = lazy(() => import('@/features/items/ItemRosterView'))
const ItemDetailView = lazy(() => import('@/features/items/ItemDetailView'))
const RelationshipGraphView = lazy(() => import('@/features/relationships/RelationshipGraphView'))
const TimelineView = lazy(() => import('@/features/timeline/TimelineView'))
const ChapterDetailView = lazy(() => import('@/features/timeline/ChapterDetailView'))
const CharacterArcView = lazy(() => import('@/features/arc/CharacterArcView'))
const WorldSettingsView = lazy(() => import('@/features/worlds/WorldSettingsView'))
const LoreView = lazy(() => import('@/features/lore/LoreView'))
const LorePageEditor = lazy(() => import('@/features/lore/LorePageEditor'))
const FactionsView = lazy(() => import('@/features/factions/FactionsView'))
const KnowledgeView = lazy(() => import('@/features/knowledge/KnowledgeView'))
const ManuscriptView = lazy(() => import('@/features/manuscript/ManuscriptView'))
const CorkboardView = lazy(() => import('@/features/corkboard/CorkboardView'))
const CalendarView = lazy(() => import('@/features/calendar/CalendarView'))
const StructureView = lazy(() => import('@/features/structure/StructureView'))

function Loading() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-[hsl(var(--border))] border-t-[hsl(var(--ring))]" />
    </div>
  )
}

/**
 * The routes reading mode takes away, taken from the same list the nav filters
 * on rather than repeated here. Marking a nav item `writingOnly` now hides the
 * link *and* closes the route, so the two cannot drift apart — which they had:
 * the links were hidden while /corkboard, /structure and /manuscript stayed
 * reachable by typing the URL, and the corkboard let a reader drag scene cards
 * between chapters.
 */
const WRITING_ONLY = new Set(navItems.filter((n) => n.writingOnly).map((n) => n.to))

/** Send a reader back to the dashboard rather than into a writing screen. */
function WritersOnly({ children }: { children: React.ReactNode }) {
  const { worldId } = useParams<{ worldId: string }>()
  const world = useWorld(worldId ?? null)
  // Undefined while Dexie is still opening. Deciding now would either flash the
  // screen at a reader or bounce a writer out of their own draft, so wait.
  if (world === undefined) return <Loading />
  if (world.readingMode) return <Navigate to={`/worlds/${worldId}`} replace />
  return <>{children}</>
}

function Wrap({ children, path }: { children: React.ReactNode; path?: string }) {
  const guarded = path !== undefined && WRITING_ONLY.has(path)
  return (
    <Suspense fallback={<Loading />}>
      {guarded ? <WritersOnly>{children}</WritersOnly> : children}
    </Suspense>
  )
}

export const router = createHashRouter([
  {
    path: '/',
    element: <Wrap><WorldSelectorView /></Wrap>,
  },
  {
    path: '/worlds/:worldId',
    element: <AppShell />,
    children: [
      { index: true, element: <Wrap><WorldDashboardView /></Wrap> },
      { path: 'maps', element: <Wrap path="maps"><MapExplorerView /></Wrap> },
      { path: 'characters', element: <Wrap path="characters"><CharacterRosterView /></Wrap> },
      { path: 'characters/:characterId', element: <Wrap><CharacterDetailView /></Wrap> },
      { path: 'items', element: <Wrap path="items"><ItemRosterView /></Wrap> },
      { path: 'items/:itemId', element: <Wrap><ItemDetailView /></Wrap> },
      { path: 'relationships', element: <Wrap path="relationships"><RelationshipGraphView /></Wrap> },
      { path: 'timeline', element: <Wrap path="timeline"><TimelineView /></Wrap> },
      { path: 'timeline/:chapterId', element: <Wrap><ChapterDetailView /></Wrap> },
      { path: 'corkboard', element: <Wrap path="corkboard"><CorkboardView /></Wrap> },
      { path: 'calendar', element: <Wrap path="calendar"><CalendarView /></Wrap> },
      { path: 'structure', element: <Wrap path="structure"><StructureView /></Wrap> },
      { path: 'arc', element: <Wrap path="arc"><CharacterArcView /></Wrap> },
      { path: 'settings', element: <Wrap path="settings"><WorldSettingsView /></Wrap> },
      { path: 'lore', element: <Wrap path="lore"><LoreView /></Wrap> },
      { path: 'lore/:pageId', element: <Wrap><LorePageEditor /></Wrap> },
      { path: 'factions', element: <Wrap path="factions"><FactionsView /></Wrap> },
      { path: 'knowledge', element: <Wrap path="knowledge"><KnowledgeView /></Wrap> },
      { path: 'manuscript', element: <Wrap path="manuscript"><ManuscriptView /></Wrap> },
    ],
  },
])
