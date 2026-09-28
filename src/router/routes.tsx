import { lazy, Suspense } from 'react'
import { createHashRouter, Navigate, useLocation, useParams } from 'react-router-dom'
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
const TimelineScreen = lazy(() => import('@/features/timeline/TimelineScreen'))
const CharacterArcView = lazy(() => import('@/features/arc/CharacterArcView'))
const WorldSettingsView = lazy(() => import('@/features/worlds/WorldSettingsView'))
const LoreView = lazy(() => import('@/features/lore/LoreView'))
const LorePageEditor = lazy(() => import('@/features/lore/LorePageEditor'))
const FactionsView = lazy(() => import('@/features/factions/FactionsView'))
const KnowledgeView = lazy(() => import('@/features/knowledge/KnowledgeView'))
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
 * the links were hidden while /corkboard and /structure stayed
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
  if (!world.readingMode) return <>{children}</>
  return <Navigate to={`/worlds/${worldId}`} replace />
}

/**
 * The Manuscript was the Timeline, at /timeline, until the two screens became
 * one. Links, bookmarks and a browser's history still say /timeline, with a
 * chapter after it and a query on the end; each lands on the same place in the
 * Manuscript.
 */
function TimelineAddress() {
  const { worldId, '*': rest } = useParams<{ worldId: string; '*': string }>()
  const { search } = useLocation()
  return <Navigate to={`/worlds/${worldId}/manuscript${rest ? `/${rest}` : ''}${search}`} replace />
}

function Wrap({ children, path }: { children: React.ReactNode; path?: string }) {
  const guarded = path !== undefined && WRITING_ONLY.has(path)
  return (
    <Suspense fallback={<Loading />}>
      {guarded && path !== undefined ? <WritersOnly>{children}</WritersOnly> : children}
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
      /*
        One page. The binder is the frame and the book is the page; a chapter in
        the address is the chapter the page is open at — see `TimelineView`. It
        was two screens that looked nothing alike, and then one frame around
        those two, and one route keeps it from becoming two again: the page is
        not remounted when a chapter is opened or closed.
      */
      {
        path: 'manuscript',
        element: <Wrap path="manuscript"><TimelineScreen /></Wrap>,
        children: [
          { path: ':chapterId?', element: <Wrap><TimelineView /></Wrap> },
        ],
      },
      { path: 'corkboard', element: <Wrap path="corkboard"><CorkboardView /></Wrap> },
      { path: 'calendar', element: <Wrap path="calendar"><CalendarView /></Wrap> },
      { path: 'structure', element: <Wrap path="structure"><StructureView /></Wrap> },
      { path: 'arc', element: <Wrap path="arc"><CharacterArcView /></Wrap> },
      { path: 'settings', element: <Wrap path="settings"><WorldSettingsView /></Wrap> },
      { path: 'lore', element: <Wrap path="lore"><LoreView /></Wrap> },
      { path: 'lore/:pageId', element: <Wrap><LorePageEditor /></Wrap> },
      { path: 'factions', element: <Wrap path="factions"><FactionsView /></Wrap> },
      { path: 'knowledge', element: <Wrap path="knowledge"><KnowledgeView /></Wrap> },
      { path: 'timeline/*', element: <TimelineAddress /> },
    ],
  },
])
